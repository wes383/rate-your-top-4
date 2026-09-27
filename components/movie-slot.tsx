"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Plus, RefreshCw, Trash2 } from "lucide-react";
import type { MovieBrief } from "@/lib/types";
import type { Lang } from "@/lib/i18n";
import { displayTitle, secondaryTitle } from "@/lib/display";
import { MoviePoster } from "@/components/movie-poster";
import { useI18n } from "@/components/providers";

export function MovieSlot({
  index,
  movie,
  lang,
  onPick,
  onRemove,
  onMoveLeft,
  onMoveRight,
  canMoveLeft,
  canMoveRight,
}: {
  index: number;
  movie: MovieBrief | null;
  lang: Lang;
  onPick: () => void;
  onRemove: () => void;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  canMoveLeft: boolean;
  canMoveRight: boolean;
}) {
  const { t } = useI18n();
  const rankLabel = t("builder.rank", { n: index + 1 });

  if (!movie) {
    return (
      <button
        type="button"
        onClick={onPick}
        className="group flex h-full w-full flex-col rounded-lg border border-dashed border-border-strong bg-surface p-3 text-left transition-colors duration-base hover:border-foreground-subtle hover:bg-hover-bg"
      >
        <div className="poster-fallback flex aspect-[2/3] w-full items-center justify-center rounded-md">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface/80 text-foreground-muted transition-transform duration-base group-hover:scale-105">
            <Plus className="h-5 w-5" aria-hidden="true" />
          </span>
        </div>
        <div className="flex flex-1 flex-col gap-1 pt-3">
          <span className="text-xs font-medium text-foreground-subtle">{rankLabel}</span>
          <span className="text-sm font-medium">{t("builder.empty")}</span>
        </div>
      </button>
    );
  }

  const primary = displayTitle(movie, lang);
  const secondary = secondaryTitle(movie, lang);

  return (
    <div className="flex h-full flex-col rounded-lg border border-border bg-surface p-3 transition-colors duration-base hover:border-border-strong">
      <div className="group relative">
        <MoviePoster posterPath={movie.posterPath} title={primary} />

        {/* Hover actions sit on a dark scrim, so their fill must stay opaque —
            a translucent hover tint would let the poster show through. */}
        <div className="absolute inset-0 flex items-center justify-center gap-1.5 rounded-md bg-[var(--overlay-strong)] opacity-0 transition-opacity duration-base group-hover:opacity-100 group-focus-within:opacity-100">
          <button
            type="button"
            onClick={onPick}
            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-surface px-3 text-xs font-medium text-foreground transition-colors hover:bg-hover-surface"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            {t("builder.replace")}
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label={t("builder.remove")}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-surface text-red-fg transition-colors hover:bg-hover-surface-danger"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1 pt-3">
        <span className="text-xs font-medium text-foreground-subtle">{rankLabel}</span>
        {/* Year sits on the title's baseline, aligned to the right edge. */}
        <div className="flex items-baseline justify-between gap-2">
          <span className="line-clamp-2 text-sm leading-snug font-medium">{primary}</span>
          {movie.year !== null && (
            <span className="shrink-0 font-mono text-xs text-foreground-muted">
              {movie.year}
            </span>
          )}
        </div>
        {secondary && (
          <span className="line-clamp-1 text-xs text-foreground-subtle">{secondary}</span>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-border pt-2">
        <button
          type="button"
          onClick={onMoveLeft}
          disabled={!canMoveLeft}
          aria-label={t("builder.moveLeft")}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-foreground-subtle transition-colors hover:bg-hover-bg hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        <span className="font-mono text-[11px] text-foreground-faint">
          #{index + 1}
        </span>
        <button
          type="button"
          onClick={onMoveRight}
          disabled={!canMoveRight}
          aria-label={t("builder.moveRight")}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-foreground-subtle transition-colors hover:bg-hover-bg hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
