import { displayTitle } from "@/lib/display";
import { posterUrl } from "@/lib/media";
import {
  proxiedImageUrl,
  reportImageFailure,
  shouldUseImageProxy,
} from "@/lib/image-proxy";
import { DIM_STROKE } from "@/lib/tones";
import type { Lang } from "@/lib/i18n";
import type { BuildResult, NormalizedFilm, SchoolKey, Tier } from "@/lib/types";
import { formatScore } from "@/lib/utils";

/**
 * Rasterises a build into a standalone share image.
 *
 * Browser-only, and deliberately dependency-free: the card is painted with the
 * plain 2D context using the same design tokens as the app, so no DOM-to-image
 * library is needed. Remote posters are requested with
 * `crossOrigin="anonymous"` and silently skipped when the CDN refuses, which
 * keeps the canvas untainted and `toBlob` usable.
 */

const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1440;
const PAD = 76;
const CONTENT_WIDTH = CARD_WIDTH - PAD * 2;
const RIGHT = CARD_WIDTH - PAD;

/** Token names behind each tier, mirroring the `TIER_CLASS` palette. */
const TIER_TOKENS: Record<
  Tier,
  { stroke: string; soft: string; border: string; fg: string }
> = {
  S: { stroke: "--green", soft: "--green-soft", border: "--green-border", fg: "--green-fg" },
  A: { stroke: "--blue", soft: "--blue-soft", border: "--blue-border", fg: "--blue-fg" },
  B: { stroke: "--yellow", soft: "--yellow-soft", border: "--yellow-border", fg: "--yellow-fg" },
  C: { stroke: "--orange", soft: "--orange-soft", border: "--orange-border", fg: "--orange-fg" },
  F: { stroke: "--red", soft: "--red-soft", border: "--red-border", fg: "--red-fg" },
};

export interface ShareCardOptions {
  result: BuildResult;
  lang: Lang;
  /** Translator from the active language provider. */
  t: (key: string, vars?: Record<string, string | number>) => string;
  /** Absolute link printed in the card footer — the home page, not a deep link. */
  url: string;
}

/* ── Theme plumbing ───────────────────────────────────────────── */

type Theme = Record<string, string>;

const THEME_TOKENS = [
  "--background",
  "--border",
  "--foreground",
  "--foreground-muted",
  "--foreground-subtle",
  "--foreground-faint",
  "--hover-bg-strong",
  "--accent",
  ...Object.values(TIER_TOKENS).flatMap((tier) => [
    tier.stroke,
    tier.soft,
    tier.border,
    tier.fg,
  ]),
  ...Object.values(DIM_STROKE).map((value) => value.replace(/^var\(|\)$/g, "")),
];

function readTheme(): Theme {
  const styles = getComputedStyle(document.body);
  const theme: Theme = {};
  for (const name of THEME_TOKENS) {
    const value = styles.getPropertyValue(name).trim();
    if (value) theme[name] = value;
  }
  return theme;
}

/**
 * Resolve a `--font-*` token into a concrete CSS font stack.
 *
 * `getPropertyValue` returns the declared value, which still contains
 * `var(--font-inter, "Inter")` references. Those are meaningless to the canvas
 * `font` parser, so each reference is substituted by hand. Read from `<body>`:
 * the next/font hashed families are declared there, while the aggregate stacks
 * live on `:root` and reach the body by inheritance.
 */
function resolveFontStack(name: string): string {
  const styles = getComputedStyle(document.body);
  return styles
    .getPropertyValue(name)
    .replace(
      /var\(\s*(--[a-zA-Z0-9-]+)\s*(?:,\s*([^)]*))?\)/g,
      (_match, reference: string, fallback: string | undefined) =>
        styles.getPropertyValue(reference).trim() || (fallback ?? "").trim() || "sans-serif"
    )
    .replace(/\s+/g, " ")
    .trim();
}

/** A context plus everything every paint step needs. */
interface Brush {
  ctx: CanvasRenderingContext2D;
  theme: Theme;
  font: { sans: string; display: string; mono: string };
  t: ShareCardOptions["t"];
}

function applyFont(brush: Brush, weight: number, size: number, stack: keyof Brush["font"] = "sans") {
  brush.ctx.font = `${weight} ${size}px ${brush.font[stack]}`;
}

async function waitForFonts(): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return;
  try {
    await document.fonts.ready;
  } catch {
    /* the Font Loading API is unavailable — system fallbacks will be used */
  }
}

/* ── Primitives ───────────────────────────────────────────────── */

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number
) {
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fillRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
  fill: string
) {
  roundRect(ctx, x, y, w, h, radius);
  ctx.fillStyle = fill;
  ctx.fill();
}

/** Trim `text` with an ellipsis so it fits `maxWidth`. Call after `applyFont`. */
function ellipsize(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let low = 0;
  let high = text.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (ctx.measureText(`${text.slice(0, mid)}…`).width <= maxWidth) low = mid;
    else high = mid - 1;
  }
  return `${text.slice(0, low)}…`;
}

/** Fetch one image URL, resolving to null on failure instead of rejecting. */
function requestImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    // Anonymous CORS: either the image arrives drawable, or it errors and we
    // skip it. A non-CORS image would taint the canvas and break `toBlob`.
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

async function loadPoster(src: string | null): Promise<HTMLImageElement | null> {
  if (!src) return null;
  // One direct attempt (skipped when this session has already given up on
  // TMDB), then one wsrv.nl proxy retry. Direct failures count toward the
  // session threshold shared with the poster components.
  const startOnProxy = shouldUseImageProxy();
  const direct = startOnProxy ? null : await requestImage(src);
  if (direct) return direct;
  if (!startOnProxy) reportImageFailure();
  return requestImage(proxiedImageUrl(src));
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Canvas export failed"));
    }, "image/png");
  });
}

/* ── Card sections ────────────────────────────────────────────── */

function paintHeader(brush: Brush, primarySchool: SchoolKey | null) {
  const { ctx, theme } = brush;

  applyFont(brush, 700, 40, "display");
  ctx.fillStyle = theme["--foreground"];
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(brush.t("share.heading"), PAD, 126);

  // The primary school sits top-right where the date used to be, always shown
  // in full — the type size shrinks until the line fits between the heading
  // and the right edge.
  if (primarySchool) {
    const names = brush.t(`school.${primarySchool}`);
    const headingWidth = ctx.measureText(brush.t("share.heading")).width;
    const available = RIGHT - (PAD + headingWidth + 32);
    let size = 26;
    applyFont(brush, 700, size, "display");
    while (size > 15 && ctx.measureText(names).width > available) {
      size -= 1;
      applyFont(brush, 700, size, "display");
    }
    ctx.fillStyle = theme["--foreground-subtle"];
    ctx.textAlign = "right";
    ctx.fillText(names, RIGHT, 122);
  }

  ctx.strokeStyle = theme["--border"] ?? "rgba(0,0,0,0.08)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(PAD, 178);
  ctx.lineTo(RIGHT, 178);
  ctx.stroke();
}

function paintScore(brush: Brush, total: number, tier: Tier, level: number, levelRaw: number) {
  const { ctx, theme, t } = brush;
  const tokens = TIER_TOKENS[tier];

  // Score ring.
  const cx = PAD + 112;
  const cy = 368;
  const radius = 112;
  ctx.lineWidth = 20;
  ctx.lineCap = "round";

  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.strokeStyle = theme["--hover-bg-strong"] ?? "rgba(0,0,0,0.06)";
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (total / 100));
  ctx.strokeStyle = theme[tokens.stroke] ?? theme["--accent"];
  ctx.stroke();

  ctx.textAlign = "center";
  applyFont(brush, 700, 80, "display");
  ctx.fillStyle = theme["--foreground"];
  ctx.textBaseline = "middle";
  ctx.fillText(formatScore(total, 1), cx, cy - 14);

  applyFont(brush, 500, 24);
  ctx.fillStyle = theme["--foreground-subtle"];
  ctx.fillText("/ 100", cx, cy + 52);

  // Build tier column — badge centered on the ring's midline (368) so the
  // three columns share one visual axis now that the tier blurb is gone.
  const buildX = PAD + 284;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  applyFont(brush, 500, 26);
  ctx.fillStyle = theme["--foreground-subtle"];
  ctx.fillText(t("report.buildScore"), buildX, 322);

  fillRoundRect(ctx, buildX, 340, 104, 56, 14, theme[tokens.soft] ?? "transparent");
  roundRect(ctx, buildX, 340, 104, 56, 14);
  ctx.strokeStyle = theme[tokens.border] ?? "transparent";
  ctx.lineWidth = 2;
  ctx.stroke();
  applyFont(brush, 700, 34, "display");
  ctx.fillStyle = theme[tokens.fg] ?? theme["--foreground"];
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(tier, buildX + 52, 369);

  // Level column.
  const levelX = 640;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  applyFont(brush, 500, 26);
  ctx.fillStyle = theme["--foreground-subtle"];
  ctx.fillText(t("report.level", { n: level }), levelX, 300);

  applyFont(brush, 700, 46, "display");
  ctx.fillStyle = theme["--foreground"];
  ctx.fillText(ellipsize(ctx, t(`level.${level}`), CONTENT_WIDTH - (levelX - PAD)), levelX, 368);

  const barWidth = CONTENT_WIDTH - (levelX - PAD);
  fillRoundRect(ctx, levelX, 392, barWidth, 10, 5, theme["--hover-bg-strong"] ?? "rgba(0,0,0,0.06)");
  fillRoundRect(
    ctx,
    levelX,
    392,
    Math.max(10, (barWidth * Math.min(100, Math.max(0, levelRaw))) / 100),
    10,
    5,
    theme["--accent"] ?? "#25242a"
  );

  applyFont(brush, 400, 22, "mono");
  ctx.fillStyle = theme["--foreground-faint"];
  ctx.fillText(`${t("report.levelRaw")} ${formatScore(levelRaw, 1)}`, levelX, 444);
}

function paintPosters(
  brush: Brush,
  movies: NormalizedFilm[],
  posters: (HTMLImageElement | null)[],
  totals: { total: number; tier: Tier }[],
  lang: Lang
) {
  const { ctx, theme } = brush;
  const count = movies.length;
  if (count === 0) return;

  const gap = 24;
  const width = (CONTENT_WIDTH - gap * (count - 1)) / count;
  const height = Math.round(width * 1.5);
  const top = 556;

  movies.forEach((movie, index) => {
    const x = PAD + index * (width + gap);
    const poster = posters[index];
    const radius = 14;

    ctx.save();
    roundRect(ctx, x, top, width, height, radius);
    ctx.clip();
    if (poster && poster.width > 0 && poster.height > 0) {
      const scale = Math.max(width / poster.width, height / poster.height);
      const drawWidth = poster.width * scale;
      const drawHeight = poster.height * scale;
      ctx.drawImage(
        poster,
        x + (width - drawWidth) / 2,
        top + (height - drawHeight) / 2,
        drawWidth,
        drawHeight
      );
    } else {
      ctx.fillStyle = theme["--hover-bg-strong"] ?? "rgba(0,0,0,0.06)";
      ctx.fillRect(x, top, width, height);
    }
    ctx.restore();

    roundRect(ctx, x, top, width, height, radius);
    ctx.strokeStyle = theme["--border"] ?? "rgba(0,0,0,0.08)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";

    applyFont(brush, 600, 24);
    ctx.fillStyle = theme["--foreground"];
    ctx.fillText(ellipsize(ctx, displayTitle(movie, lang), width), x, top + height + 38);

    const film = totals[index];
    applyFont(brush, 700, 30, "display");
    ctx.fillStyle = theme["--foreground"];
    ctx.fillText(formatScore(film?.total ?? null, 1), x, top + height + 82);

    if (film) {
      applyFont(brush, 700, 24, "display");
      const tierFg = TIER_TOKENS[film.tier]?.fg;
      ctx.fillStyle = (tierFg ? theme[tierFg] : undefined) ?? theme["--foreground"];
      ctx.textAlign = "right";
      ctx.fillText(film.tier, x + width, top + height + 82);
    }
  });
}

function paintDimensions(brush: Brush, dimensions: BuildResult["build"]["dimensions"]) {
  const { ctx, theme, t } = brush;
  let y = 1040;

  ctx.textBaseline = "alphabetic";
  for (const dimension of dimensions) {
    const tone = (DIM_STROKE[dimension.key] ?? "var(--accent)").replace(/^var\(|\)$/g, "");

    applyFont(brush, 500, 26);
    ctx.textAlign = "left";
    ctx.fillStyle = theme["--foreground-muted"];
    ctx.fillText(t(`dim.${dimension.key}`), PAD, y);

    applyFont(brush, 500, 24, "mono");
    ctx.textAlign = "right";
    ctx.fillStyle = theme["--foreground-subtle"];
    ctx.fillText(formatScore(dimension.score, 1), RIGHT, y);

    fillRoundRect(ctx, PAD, y + 12, CONTENT_WIDTH, 10, 5, theme["--hover-bg-strong"] ?? "rgba(0,0,0,0.06)");
    fillRoundRect(
      ctx,
      PAD,
      y + 12,
      Math.max(10, (CONTENT_WIDTH * Math.min(100, Math.max(0, dimension.score))) / 100),
      10,
      5,
      theme[tone] ?? theme["--accent"]
    );

    y += 60;
  }
}

function paintFooter(brush: Brush, url: string) {
  const { ctx, theme } = brush;
  ctx.strokeStyle = theme["--border"] ?? "rgba(0,0,0,0.08)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(PAD, 1330);
  ctx.lineTo(RIGHT, 1330);
  ctx.stroke();

  applyFont(brush, 400, 22, "mono");
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = theme["--foreground-faint"];
  ctx.fillText(ellipsize(ctx, url, CONTENT_WIDTH), PAD, 1376);
}

function paintBackground(ctx: CanvasRenderingContext2D, theme: Theme) {
  ctx.fillStyle = theme["--background"] ?? "#ffffff";
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
}

/* ── Entry point ──────────────────────────────────────────────── */

/** Paint the summary card and return it as a PNG blob. */
export async function renderShareCard(options: ShareCardOptions): Promise<Blob> {
  const { result, lang, t, url } = options;
  const { build, films, movies } = result;

  await waitForFonts();

  const canvas = document.createElement("canvas");
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context is unavailable");

  const brush: Brush = {
    ctx,
    theme: readTheme(),
    font: {
      sans: resolveFontStack("--font-sans") || "sans-serif",
      display: resolveFontStack("--font-display") || "sans-serif",
      mono: resolveFontStack("--font-mono") || "monospace",
    },
    t,
  };

  const posters = await Promise.all(
    movies.map((movie) => loadPoster(posterUrl(movie.posterPath, "w500")))
  );

  paintBackground(ctx, brush.theme);
  paintHeader(brush, build.schools[0] ?? null);
  paintScore(brush, build.total, build.tier, build.level, build.levelRaw);
  paintPosters(brush, movies, posters, films, lang);
  paintDimensions(brush, build.dimensions);
  paintFooter(brush, url);

  return await canvasToBlob(canvas);
}
