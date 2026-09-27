"use client";

import * as React from "react";
import { Info } from "lucide-react";
import type { FilmScore, NormalizedFilm } from "@/lib/types";
import {
  confidenceBand,
  countryName,
  displayOverview,
  displayTitle,
  languageName,
  localeOf,
  secondaryTitle,
} from "@/lib/display";
import { genreName } from "@/lib/i18n";
import { formatCompact, formatMoney, formatNumber, formatScore } from "@/lib/utils";
import { DIM_BAR, TIER_CLASS } from "@/lib/tones";
import { LEGACY_MAX_POINTS } from "@/lib/scoring/constants";
import { Badge } from "@/components/ui/badge";
import { StatBar } from "@/components/ui/charts";
import { Modal } from "@/components/ui/modal";
import { MoviePoster } from "@/components/movie-poster";
import { useI18n } from "@/components/providers";

/** Per-film breakdown, showing every raw value behind each dimension. */
export function FilmDetailDialog({
  open,
  onClose,
  film,
  score,
}: {
  open: boolean;
  onClose: () => void;
  film: NormalizedFilm | null;
  score: FilmScore | null;
}) {
  const { t, lang } = useI18n();

  if (!film || !score) return null;

  const primary = displayTitle(film, lang);
  const secondary = secondaryTitle(film, lang);
  const overview = displayOverview(film, lang);
  const { metrics, awards } = { metrics: score.metrics, awards: film.awards };

  const rankText = (value: number | null | undefined) =>
    value === null || value === undefined
      ? t("film.notListed")
      : t("film.rankOf", { n: value });

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={primary}
      description={
        [
          secondary,
          film.year ? String(film.year) : null,
          film.director,
        ]
          .filter(Boolean)
          .join(" · ") || undefined
      }
      closeLabel={t("film.close")}
    >
      <div className="flex flex-col gap-6">
        <div className="grid gap-5 sm:grid-cols-[130px_1fr]">
          <div className="mx-auto w-[130px] sm:mx-0">
            <MoviePoster posterPath={film.posterPath} title={primary} size="w342" />
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-display text-3xl leading-none font-bold">
                {formatScore(score.total, 1)}
              </span>
              <span
                className={`rounded-md border px-2 py-0.5 text-sm font-semibold ${TIER_CLASS[score.tier]}`}
              >
                {score.tier}
              </span>
              <span className="text-xs text-foreground-muted">
                {t(`tier.${score.tier}`)}
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {film.genres.map((genre) => (
                <Badge key={genre.id} variant="outline" size="sm">
                  {genreName(genre.id, lang)}
                </Badge>
              ))}
              {film.runtime !== null && (
                <Badge variant="secondary" size="sm">
                  {t("film.minutes", { n: film.runtime })}
                </Badge>
              )}
              <Badge variant="secondary" size="sm">
                {languageName(film.originalLanguage, lang) ?? t("common.unknown")}
              </Badge>
              {film.countries.map((code) => (
                <Badge key={code} variant="secondary" size="sm">
                  {countryName(code, lang)}
                </Badge>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs sm:grid-cols-3">
              <Metric label={t("film.imdb")} value={film.imdbRating !== null ? film.imdbRating.toFixed(1) : t("common.na")} />
              <Metric label={`${t("film.imdb")} ${t("film.votes")}`} value={formatCompact(film.imdbVotes, localeOf(lang))} />
              <Metric label={t("film.tmdb")} value={film.tmdbRating !== null ? film.tmdbRating.toFixed(1) : t("common.na")} />
              <Metric label={`${t("film.tmdb")} ${t("film.votes")}`} value={formatNumber(film.tmdbVotes, localeOf(lang))} />
              <Metric label={t("film.revenue")} value={formatMoney(film.revenue, localeOf(lang))} />
              <Metric label={t("film.popularity")} value={film.popularity !== null ? film.popularity.toFixed(1) : t("common.na")} />
            </div>

            {overview && (
              <p className="text-sm leading-relaxed text-foreground-muted">{overview}</p>
            )}
          </div>
        </div>

        {/* ── Dimension breakdown ─────────────────────────────── */}
        <div className="flex flex-col gap-4">
          <h3 className="font-display text-base font-semibold tracking-tight">
            {t("film.breakdown")}
          </h3>
          {score.dimensions.map((dimension) => (
            <div key={dimension.key} className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium">{t(`dim.${dimension.key}`)}</span>
                <span className="font-mono text-foreground-muted">
                  {dimension.score === null ? (
                    <span className="inline-flex items-center gap-1 text-foreground-faint">
                      <Info className="h-3 w-3" aria-hidden="true" />
                      {t("film.unknownDimension")}
                    </span>
                  ) : (
                    <>
                      {formatScore(dimension.score, 1)} ×{" "}
                      {(dimension.effectiveWeight * 100).toFixed(0)}% ={" "}
                      {formatScore(dimension.contribution, 2)}
                    </>
                  )}
                </span>
              </div>
              <StatBar
                value={dimension.score ?? 0}
                height={5}
                muted={dimension.score === null}
                tone={DIM_BAR[dimension.key] ?? "bg-accent"}
              />

              <div className="grid gap-x-6 sm:grid-cols-2">
                {detailRows(dimension.key, dimension.detail, metrics).map((row) => (
                  <Row key={row.label} label={row.label} value={row.value} />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* ── Awards & lists ──────────────────────────────────── */}
        <div className="flex flex-col gap-2">
          <h3 className="font-display text-base font-semibold tracking-tight">
            {t("film.awardsAndLists")}
          </h3>
          {!awards ? (
            <p className="rounded-md border border-border bg-hover-bg p-3 text-xs text-foreground-muted">
              {t("film.noRecord")}
            </p>
          ) : (
            <div className="grid gap-x-6 sm:grid-cols-2">
              <Row
                label={t("film.oscar")}
                value={[
                  awards.oscar_best_picture ? t("film.oscarBestPicture") : null,
                  awards.oscar_best_director ? t("film.oscarBestDirector") : null,
                  awards.oscar_other_awards_count > 0
                    ? t("film.oscarOther", { n: awards.oscar_other_awards_count })
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || t("common.na")}
              />
              <Row
                label={t("film.festival")}
                value={
                  [
                    awards.palme_d_or ? "Palme d'Or" : null,
                    awards.golden_lion ? "Golden Lion" : null,
                    awards.golden_bear ? "Golden Bear" : null,
                    awards.cannes_grand_prix ? "Cannes Grand Prix" : null,
                    awards.cannes_best_director ? "Cannes Best Director" : null,
                    awards.cannes_jury_prize ? "Cannes Jury Prize" : null,
                    awards.venice_grand_jury_prize ? "Venice Grand Jury" : null,
                    awards.berlinale_grand_jury_prize ? "Berlinale Grand Jury" : null,
                    awards.berlinale_jury_prize ? "Berlinale Jury Prize" : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || t("common.na")
                }
              />
              <Row label={t("film.tspdt1000")} value={rankText(awards.tspdt_top_1000_rank)} />
              <Row label={t("film.tspdt21")} value={rankText(awards.tspdt_21st_century_rank)} />
              <Row
                label={t("film.sightAndSound")}
                value={rankText(awards.sight_and_sound_2022_rank)}
              />
              <Row
                label={t("film.cahiers")}
                value={
                  typeof awards.cahiers_top_10_rank === "number"
                    ? t("film.rankOf", { n: awards.cahiers_top_10_rank })
                    : t("film.notListed")
                }
              />
            </div>
          )}
        </div>

        {film.keywords.length > 0 && (
          <div className="flex flex-col gap-2">
            <h3 className="font-display text-base font-semibold tracking-tight">
              {t("film.keywords")}
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {film.keywords.slice(0, 18).map((keyword) => (
                <span
                  key={keyword.id}
                  className="rounded-full border border-border bg-hover-bg px-2 py-0.5 text-[11px] text-foreground-muted"
                >
                  {keyword.name}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="grid gap-x-6 border-t border-border pt-3 sm:grid-cols-2">
          <Row
            label={t("confidence.label")}
            value={`${score.confidence} · ${t(`confidence.${confidenceBand(score.confidence)}`)}`}
          />
          <Row
            label={t("film.missing")}
            value={score.missing.length === 0 ? t("film.noMissing") : score.missing.join(", ")}
          />
        </div>
      </div>
    </Modal>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[11px] text-foreground-faint">{label}</span>
      <span className="font-mono text-xs text-foreground">{value}</span>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border py-1.5 last:border-b-0">
      <span className="text-xs text-foreground-muted">{label}</span>
      <span className="font-mono text-xs text-foreground">{value}</span>
    </div>
  );
}

/** Raw values shown under each dimension, keyed by dimension. */
function detailRows(
  dimension: string,
  detail: Record<string, number | string | null> | undefined,
  metrics: Record<string, number | null>
): { label: string; value: string }[] {
  const num = (value: number | string | null | undefined, digits = 1) =>
    value === null || value === undefined ? "—" : Number(value).toFixed(digits);
  const int = (value: number | null | undefined) =>
    value === null || value === undefined ? "—" : formatNumber(value, "en-US");

  if (dimension === "audience") {
    return [
      { label: "IMDb", value: `${num(detail?.imdbRating)} / 10 · ${int(detail?.imdbVotes as number)} votes` },
      { label: "TMDB", value: `${num(detail?.tmdbRating)} / 10 · ${int(detail?.tmdbVotes as number)} votes` },
      { label: "Weighted rating (Bayes)", value: num(metrics["audience.weightedRating"], 3) },
      { label: "Bayes score × vote credibility", value: `${num(metrics["audience.bayes"])} × ${num(metrics["audience.credibility"])}` },
      { label: "IMDb strength", value: num(metrics["audience.imdbStrength"]) },
      { label: "TMDB score", value: num(metrics["audience.tmdbScore"]) },
    ];
  }
  if (dimension === "legacy") {
    // The denominator shrinks for films the 21st Century list cannot contain,
    // so it comes from the engine rather than from the global constant.
    const legacyMax = metrics["legacy.maxPoints"] ?? LEGACY_MAX_POINTS;
    const list21stExcluded = legacyMax !== LEGACY_MAX_POINTS;
    return [
      { label: "TSPDT Top 1000", value: `${rankOrDash(detail?.tspdtTop1000)} → ${num(metrics["legacy.tspdtTop1000"], 2)}` },
      {
        label: "TSPDT 21st century",
        // UNKNOWN rather than 0: the list cannot contain a pre-2000 film.
        value: list21stExcluded
          ? "— → not applicable"
          : `${rankOrDash(detail?.tspdt21stCentury)} → ${num(metrics["legacy.tspdt21stCentury"], 2)}`,
      },
      { label: "Sight & Sound critics", value: `${rankOrDash(detail?.sightAndSound)} → ${num(metrics["legacy.sightAndSound"], 2)}` },
      { label: "Cahiers du Cinéma", value: `${rankOrDash(detail?.cahiers)} → ${num(metrics["legacy.cahiers"], 2)}` },
      {
        label: `List points / ${legacyMax}`,
        value: `${num(metrics["legacy.raw"], 2)} / ${legacyMax}`,
      },
    ];
  }
  if (dimension === "awards") {
    return [
      { label: "Oscar", value: `${num(metrics["awards.oscarRaw"], 1)} / 15 → ${num(metrics["awards.oscar"])}` },
      { label: "Festivals", value: `${num(metrics["awards.festivalRaw"], 1)} / 10 → ${num(metrics["awards.festival"])}` },
      { label: "Breadth", value: num(metrics["awards.breadth"]) },
      {
        label: "Flags",
        value: [
          detail?.bestPicture ? "BP" : null,
          detail?.bestDirector ? "BD" : null,
          detail?.palmeDOr ? "Palme" : null,
          detail?.goldenLion ? "Lion" : null,
          detail?.goldenBear ? "Bear" : null,
        ]
          .filter(Boolean)
          .join(" · ") || "—",
      },
    ];
  }
  return [
    { label: "IMDb votes", value: `${num(metrics["footprint.imdbVotes"])} / 40` },
    { label: "TMDB votes", value: `${num(metrics["footprint.tmdbVotes"])} / 30` },
    { label: "Box office", value: `${num(metrics["footprint.revenue"])} / 15` },
    { label: "Popularity", value: `${num(metrics["footprint.popularity"])} / 15` },
  ];
}

function rankOrDash(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  return `#${value}`;
}
