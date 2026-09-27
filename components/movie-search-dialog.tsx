"use client";

import * as React from "react";
import { AlertCircle, Check, Search } from "lucide-react";
import type { MovieBrief } from "@/lib/types";
import type { Lang } from "@/lib/i18n";
import { displayTitle, secondaryTitle } from "@/lib/display";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Input, InputWithIcon } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/charts";
import { MoviePoster } from "@/components/movie-poster";
import { useI18n } from "@/components/providers";
import { isImdbIdQuery, isSearchableQuery } from "@/lib/search-query";

interface SearchState {
  status: "idle" | "loading" | "done" | "error";
  results: MovieBrief[];
  tmdbConfigured: boolean;
  degraded: boolean;
}

const EMPTY_STATE: SearchState = {
  status: "idle",
  results: [],
  tmdbConfigured: true,
  degraded: false,
};

/** Response payload of `/api/search`, tagged with the request it answers. */
interface SearchResult {
  query: string;
  lang: Lang;
  status: "done" | "error";
  results: MovieBrief[];
  tmdbConfigured: boolean;
  degraded: boolean;
}

/** Debounced movie search dialog with full keyboard navigation. */
export function MovieSearchDialog({
  open,
  onClose,
  onSelect,
  selectedIds,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (movie: MovieBrief) => void;
  selectedIds: number[];
}) {
  const { t, lang } = useI18n();
  const [query, setQuery] = React.useState("");
  const [result, setResult] = React.useState<SearchResult | null>(null);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const listRef = React.useRef<HTMLDivElement>(null);

  const trimmed = query.trim();

  // The effect only performs the request; what the UI renders is derived
  // below, so no status has to be kept in sync by hand.
  React.useEffect(() => {
    if (!isSearchableQuery(trimmed)) return;

    const controller = new AbortController();
    // An IMDb ID is an exact paste-and-go lookup — no reason to wait out the
    // debounce a title query needs to avoid hammering on every keystroke.
    const delay = isImdbIdQuery(trimmed) ? 0 : 280;
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(trimmed)}&lang=${lang}`,
          { signal: controller.signal }
        );
        const payload = (await response.json()) as {
          results?: MovieBrief[];
          tmdbConfigured?: boolean;
          degraded?: boolean;
        };
        setResult({
          query: trimmed,
          lang,
          status: response.ok ? "done" : "error",
          results: payload.results ?? [],
          tmdbConfigured: payload.tmdbConfigured ?? true,
          degraded: payload.degraded ?? false,
        });
        setActiveIndex(0);
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        setResult({
          query: trimmed,
          lang,
          status: "error",
          results: [],
          tmdbConfigured: true,
          degraded: false,
        });
      }
    }, delay);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [trimmed, lang]);

  /**
   * The state the UI renders. A stored result only counts when it answers the
   * current query *and* language; anything else is in flight.
   */
  const state = React.useMemo<SearchState>(() => {
    if (!isSearchableQuery(trimmed)) return EMPTY_STATE;
    if (result && result.query === trimmed && result.lang === lang) {
      return {
        status: result.status,
        results: result.results,
        tmdbConfigured: result.tmdbConfigured,
        degraded: result.degraded,
      };
    }
    // Carry the last known source status so the offline notice cannot flicker.
    return {
      status: "loading",
      results: [],
      tmdbConfigured: result?.tmdbConfigured ?? true,
      degraded: result?.degraded ?? false,
    };
  }, [trimmed, result, lang]);

  const selectable = React.useMemo(
    () => state.results.map((movie) => !selectedIds.includes(movie.tmdbId)),
    [state.results, selectedIds]
  );

  const moveActive = React.useCallback(
    (direction: 1 | -1) => {
      if (state.results.length === 0) return;
      setActiveIndex((prev) => {
        let next = prev;
        for (let step = 0; step < state.results.length; step += 1) {
          next = (next + direction + state.results.length) % state.results.length;
          if (selectable[next]) break;
        }
        return next;
      });
    },
    [state.results.length, selectable]
  );

  const commit = React.useCallback(
    (index: number) => {
      const movie = state.results[index];
      if (!movie || !selectable[index]) return;
      onSelect(movie);
      onClose();
    },
    [onClose, onSelect, selectable, state.results]
  );

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveActive(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveActive(-1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      commit(activeIndex);
    }
  };

  // Keep the active row inside the scroll viewport.
  React.useEffect(() => {
    const container = listRef.current;
    if (!container) return;
    const active = container.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    active?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const showOfflineNotice =
    state.status !== "idle" && !state.tmdbConfigured;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("search.title")}
      description={t("search.hint")}
      closeLabel={t("common.close")}
    >
      <div className="flex flex-col gap-4">
        <InputWithIcon
          leadingIcon={<Search className="h-4 w-4" aria-hidden="true" />}
          size="md"
        >
          <Input
            data-autofocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t("search.placeholder")}
            aria-label={t("search.title")}
            autoComplete="off"
            spellCheck={false}
          />
        </InputWithIcon>

        {/* Fixed-height region below the input: the modal keeps one size while
            the search state moves idle → loading → results, so nothing jumps. */}
        <div className="flex h-[46vh] flex-col gap-3">
          {showOfflineNotice && (
            <div className="flex shrink-0 items-start gap-2 rounded-md border border-orange-border bg-orange-soft p-3 text-xs text-orange-fg">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{t("search.offlineHint")}</span>
            </div>
          )}

          {state.status === "loading" && (
            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="flex items-center gap-3">
                  <Skeleton className="h-16 w-11 shrink-0" />
                  <div className="flex flex-1 flex-col gap-2">
                    <Skeleton className="h-3.5 w-2/5" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {state.status === "idle" && (
            <p className="flex flex-1 items-center justify-center text-center text-sm text-foreground-subtle">
              {t("search.startTyping")}
            </p>
          )}

          {state.status === "error" && (
            <p className="flex flex-1 items-center justify-center text-center text-sm text-red-fg">
              {t("search.error")}
            </p>
          )}

          {state.status === "done" && state.results.length === 0 && (
            <p className="flex flex-1 items-center justify-center text-center text-sm text-foreground-subtle">
              {t("search.empty")}
            </p>
          )}

          {state.status === "done" && state.results.length > 0 && (
            <>
              <div className="flex shrink-0 items-center justify-between text-xs text-foreground-subtle">
                <span>{t("search.results", { n: state.results.length })}</span>
                {state.degraded && (
                  <Badge variant="warning" size="sm">
                    {t("search.offlineBadge")}
                  </Badge>
                )}
              </div>
              <div ref={listRef} className="-mx-1 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-1">
              {state.results.map((movie, index) => {
                const isSelected = selectedIds.includes(movie.tmdbId);
                const primary = displayTitle(movie, lang);
                const secondary = secondaryTitle(movie, lang);
                return (
                  <button
                    key={movie.tmdbId}
                    type="button"
                    data-index={index}
                    onClick={() => commit(index)}
                    onMouseEnter={() => !isSelected && setActiveIndex(index)}
                    disabled={isSelected}
                    className={cn(
                      "flex items-center gap-3 rounded-md border border-transparent p-2 text-left transition-colors duration-base",
                      isSelected
                        ? "cursor-not-allowed opacity-55"
                        : index === activeIndex
                          ? "border-border-strong bg-hover-bg"
                          : "hover:bg-hover-bg"
                    )}
                  >
                    <div className="w-11 shrink-0">
                      <MoviePoster
                        posterPath={movie.posterPath}
                        title={primary}
                        size="w185"
                      />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="truncate text-sm font-medium">{primary}</span>
                      {secondary && (
                        <span className="truncate text-xs text-foreground-subtle">
                          {secondary}
                        </span>
                      )}
                      {movie.year !== null && (
                        <span className="font-mono text-xs text-foreground-muted">
                          {movie.year}
                        </span>
                      )}
                    </div>
                    {isSelected && (
                      <span className="flex shrink-0 items-center gap-1 text-xs text-foreground-subtle">
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                        {t("search.alreadySelected")}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}
        </div>
      </div>
    </Modal>
  );
}
