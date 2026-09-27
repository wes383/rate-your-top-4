"use client";

import * as React from "react";
import { AlertCircle, Trash2 } from "lucide-react";
import type { BuildResult, MovieBrief, NormalizedFilm } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/charts";
import { BuildReport } from "@/components/build-report";
import { FilmDetailDialog } from "@/components/film-detail";
import { MovieSearchDialog } from "@/components/movie-search-dialog";
import { MovieSlot } from "@/components/movie-slot";
import { SiteFooter } from "@/components/site-footer";
import { useI18n } from "@/components/providers";

type BuildResponse = BuildResult & {
  meta: { tmdbConfigured: boolean; demo: boolean; generatedAt: string };
};

interface StatusPayload {
  tmdbConfigured: boolean;
  imdbConfigured: boolean;
  awardDatasetSize: number;
}

const SLOT_COUNT = 4;

function emptySlots(): (MovieBrief | null)[] {
  return Array.from({ length: SLOT_COUNT }, () => null);
}

/** Build the lightweight slot record from a resolved film. */
function toBrief(film: NormalizedFilm): MovieBrief {
  return {
    tmdbId: film.tmdbId,
    title: film.title,
    titleZh: film.titleZh,
    originalTitle: film.originalTitle,
    year: film.year,
    posterPath: film.posterPath,
    tmdbRating: film.tmdbRating,
    overview: film.overview,
    overviewZh: film.overviewZh,
    inAwardDataset: film.awards !== null,
    source: film.source,
  };
}

export default function HomePage() {
  const { t, lang } = useI18n();

  const [slots, setSlots] = React.useState<(MovieBrief | null)[]>(emptySlots);
  const [pickerIndex, setPickerIndex] = React.useState<number | null>(null);
  const [result, setResult] = React.useState<BuildResponse | null>(null);
  const [resultKey, setResultKey] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [detailIndex, setDetailIndex] = React.useState<number | null>(null);
  const [status, setStatus] = React.useState<StatusPayload | null>(null);

  const currentIds = slots.map((slot) => slot?.tmdbId ?? null);
  const currentKey = currentIds.filter((id) => id !== null).join(",");
  const filled = currentIds.filter((id) => id !== null).length;
  const complete = filled === SLOT_COUNT;
  // The report is only shown while it still describes the current four slots.
  const showReport = result !== null && resultKey === currentKey && complete;

  /* ── Data source status ─────────────────────────────────────── */
  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/status")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: StatusPayload | null) => {
        if (!cancelled && payload) setStatus(payload);
      })
      .catch(() => {
        /* status is advisory; the app still works without it */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const evaluate = React.useCallback(
    async (ids: number[], options: { scroll?: boolean } = {}) => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/build", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ids }),
        });
        const payload = await response.json();
        if (!response.ok) {
          const code = (payload?.error as string) ?? "SERVER_ERROR";
          setError(
            code === "NOT_CONFIGURED"
              ? status?.tmdbConfigured === false
                ? t("errors.notConfiguredDemo")
                : t("errors.notConfigured")
              : code === "NOT_FOUND"
                ? t("errors.notFound")
                : code === "UPSTREAM" || code === "NETWORK"
                  ? t("errors.upstream")
                  : t("errors.generic")
          );
          setResult(null);
          setResultKey(null);
          return;
        }

        const buildResult = payload as BuildResponse;
        setResult(buildResult);
        setResultKey(ids.join(","));
        setSlots(buildResult.movies.map(toBrief));
        window.history.replaceState(null, "", `?m=${ids.join(",")}`);
        if (options.scroll !== false) {
          window.setTimeout(() => {
            document.getElementById("report")?.scrollIntoView({ block: "start" });
          }, 60);
        }
      } catch {
        setError(t("errors.generic"));
        setResult(null);
        setResultKey(null);
      } finally {
        setLoading(false);
      }
    },
    [status, t]
  );

  /* ── Deep link: ?m=1,2,3,4 ──────────────────────────────────── */
  // The query string is parsed here rather than during render: `window.location`
  // does not exist on the server, so reading it while rendering would produce a
  // hydration mismatch.
  const bootstrapped = React.useRef(false);
  React.useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("m");
    if (!raw) return;
    const ids = raw
      .split(",")
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isInteger(value) && value > 0)
      .slice(0, SLOT_COUNT);
    if (ids.length !== SLOT_COUNT) return;
    // Start the request in a separate task: `evaluate` flips the loading flag
    // synchronously, and a state update inside this effect body would cause a
    // cascading render right after mount.
    //
    // The timer is deliberately left uncancelled. React double-invokes effects
    // in development (setup → cleanup → setup) and the guard above turns the
    // second setup into a no-op, so cancelling here would discard the only
    // timer that is ever scheduled and the deep link would silently do nothing.
    // The callback only dispatches a fetch, so a stray fire is harmless.
    window.setTimeout(() => void evaluate(ids, { scroll: false }), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelect = (movie: MovieBrief) => {
    if (pickerIndex === null) return;
    setSlots((prev) => {
      const next = [...prev];
      // A movie can only occupy one slot: move it rather than duplicate it.
      const existing = next.findIndex((slot) => slot?.tmdbId === movie.tmdbId);
      if (existing !== -1) next[existing] = null;
      next[pickerIndex] = movie;
      return next;
    });
  };

  const handleRemove = (index: number) => {
    setSlots((prev) => {
      const next = [...prev];
      next[index] = null;
      return next;
    });
  };

  const handleMove = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= SLOT_COUNT) return;
    setSlots((prev) => {
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const handleClear = () => {
    setSlots(emptySlots());
    setResult(null);
    setResultKey(null);
    setError(null);
    window.history.replaceState(null, "", window.location.pathname);
  };

  const detailFilm = detailIndex !== null && result ? result.movies[detailIndex] : null;
  const detailScore = detailIndex !== null && result ? result.films[detailIndex] : null;
  const tmdbMissing = status !== null && !status.tmdbConfigured;

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <main className="mx-auto w-full max-w-[1200px] flex-1 px-6 pt-12 pb-12 lg:px-8 lg:pt-16">
        {/* ── Builder ────────────────────────────────────────────── */}
        <section id="build" className="scroll-mt-6">
          <h1 className="mb-5 font-display text-2xl font-bold tracking-tight">
            {t("builder.title")}
          </h1>

          {tmdbMissing && (
            <div className="mb-5 flex items-start gap-2 rounded-lg border border-orange-border bg-orange-soft p-4 text-sm text-orange-fg">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{t("errors.notConfiguredDemo")}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {slots.map((movie, index) => (
              <MovieSlot
                key={index}
                index={index}
                movie={movie}
                lang={lang}
                onPick={() => setPickerIndex(index)}
                onRemove={() => handleRemove(index)}
                onMoveLeft={() => handleMove(index, -1)}
                onMoveRight={() => handleMove(index, 1)}
                canMoveLeft={index > 0 && movie !== null}
                canMoveRight={index < SLOT_COUNT - 1 && movie !== null}
              />
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button
              size="lg"
              onClick={() =>
                void evaluate(currentIds.filter((id): id is number => id !== null))
              }
              loading={loading}
              disabled={!complete}
            >
              {loading ? t("builder.evaluating") : t("builder.evaluate")}
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={handleClear}
              disabled={filled === 0 && result === null}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              {t("builder.clear")}
            </Button>
            <span className="ml-auto font-mono text-xs text-foreground-subtle">
              {t("builder.progress", { n: filled })}
            </span>
          </div>

          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-border bg-red-soft p-4 text-sm text-red-fg">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}
        </section>

        {/* ── Report ─────────────────────────────────────────────── */}
        {(loading || showReport) && (
          <div className="mt-16">
            {loading && !showReport && (
              <Card>
                <CardContent className="flex flex-col gap-4 p-6">
                  <Skeleton className="h-6 w-40" />
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Skeleton className="h-28" />
                    <Skeleton className="h-28" />
                    <Skeleton className="h-28" />
                  </div>
                </CardContent>
              </Card>
            )}

            {!loading && showReport && result && (
              <BuildReport result={result} onOpenFilm={setDetailIndex} />
            )}
          </div>
        )}
      </main>

      <SiteFooter />

      {/* Keyed by slot: each open starts from a clean search state. */}
      <MovieSearchDialog
        key={pickerIndex ?? "closed"}
        open={pickerIndex !== null}
        onClose={() => setPickerIndex(null)}
        onSelect={handleSelect}
        selectedIds={currentIds.filter((id): id is number => id !== null)}
      />

      <FilmDetailDialog
        open={detailIndex !== null}
        onClose={() => setDetailIndex(null)}
        film={detailFilm}
        score={detailScore}
      />
    </div>
  );
}
