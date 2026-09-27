"use client";

import * as React from "react";
import {
  ArrowUpRight,
  Award,
  BadgeCheck,
  CircleSlash,
  Factory,
  Globe2,
  Info,
  Layers,
  Users,
} from "lucide-react";
import type { BuildResult, DimensionKey, FilmScore, Tier } from "@/lib/types";
import { displayTitle, languageName, secondaryTitle } from "@/lib/display";
import { eraLabel, genreName } from "@/lib/i18n";
import { formatScore } from "@/lib/utils";
import { DIM_BAR, DIM_DOT, DIM_STROKE, TIER_CLASS, TIER_STROKE, filmDimensionTone } from "@/lib/tones";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadarChart, ScoreRing, StatBar } from "@/components/ui/charts";
import { MoviePoster } from "@/components/movie-poster";
import { ShareReport } from "@/components/share-report";
import { useI18n } from "@/components/providers";

const FILM_DIMENSIONS: DimensionKey[] = ["audience", "legacy", "awards", "footprint"];

function findDimension(film: FilmScore, key: DimensionKey) {
  return film.dimensions.find((dimension) => dimension.key === key);
}

/** Full evaluation report for one Top 4 build. */
export function BuildReport({
  result,
  onOpenFilm,
}: {
  result: BuildResult;
  onOpenFilm: (index: number) => void;
}) {
  const { t, lang } = useI18n();

  const { build, films, diagnostics, movies } = result;
  const baseScore = build.dimensions.reduce(
    (acc, dimension) => acc + dimension.contribution,
    0
  );
  const totalAdjustment = build.adjustments.reduce(
    (acc, adjustment) => acc + adjustment.delta,
    0
  );

  return (
    <section id="report" className="scroll-mt-20">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-2xl font-bold tracking-tight">
            {t("report.title")}
          </h2>
          <p className="text-sm text-foreground-muted">{t("report.formulaNote")}</p>
        </div>
        <ShareReport result={result} />
      </div>

      {/* ── Summary ─────────────────────────────────────────────── */}
      <Card className="overflow-hidden">
        <CardContent className="grid gap-8 p-6 lg:grid-cols-[auto_1fr_1fr_auto]">
          {/* Score ring, topped by the breakdown + schools badges */}
          <div className="flex flex-col items-center gap-4">
            <div className="flex max-w-[24rem] flex-wrap items-center justify-center gap-2">
              <Badge variant="outline" size="sm">
                <Layers className="h-3 w-3" aria-hidden="true" />
                {t("report.baseScore")} {formatScore(baseScore, 1)}
              </Badge>
              <Badge
                variant={totalAdjustment === 0 ? "secondary" : totalAdjustment > 0 ? "success" : "danger"}
                size="sm"
              >
                {totalAdjustment > 0 ? "+" : ""}
                {totalAdjustment}
              </Badge>
              {build.schools.map((school, index) => (
                <Badge
                  key={school}
                  variant={index === 0 ? "default" : "secondary"}
                  size="sm"
                  title={
                    index === 0 ? t("report.schoolsPrimary") : undefined
                  }
                >
                  {t(`school.${school}`)}
                </Badge>
              ))}
            </div>
            <ScoreRing
              value={build.total}
              tone={TIER_STROKE[build.tier]}
              size={176}
              strokeWidth={11}
            >
              <span className="font-display text-5xl leading-none font-bold">
                {formatScore(build.total, 1)}
              </span>
              <span className="mt-1.5 text-sm text-foreground-subtle">
                / 100
              </span>
            </ScoreRing>
            <Badge
              variant={
                build.confidenceLevel === "high"
                  ? "success"
                  : build.confidenceLevel === "medium"
                    ? "info"
                    : build.confidenceLevel === "low"
                      ? "warning"
                      : "danger"
              }
              size="sm"
            >
              <BadgeCheck className="h-3 w-3" aria-hidden="true" />
              {t("confidence.label")} {build.confidence} ·{" "}
              {t(`confidence.${build.confidenceLevel}`)}
            </Badge>
          </div>

          {/* Build tier */}
          <div className="flex flex-col justify-center gap-1.5">
            <span className="text-sm text-foreground-subtle">
              {t("report.buildScore")}
            </span>
            <span
              className={`inline-flex w-fit items-center gap-1.5 rounded-md border px-3 py-1 text-base font-semibold ${TIER_CLASS[build.tier]}`}
            >
              {build.tier}
            </span>
            <span className="max-w-[16rem] text-sm text-foreground-muted">
              {t(`tier.${build.tier}`)}
            </span>
          </div>

          {/* Level */}
          <div className="flex flex-col justify-center gap-1.5">
            <span className="text-sm text-foreground-subtle">
              {t("report.level", { n: build.level })}
            </span>
            <span className="font-display text-2xl leading-tight font-bold">
              {t(`level.${build.level}`)}
            </span>
            <StatBar
              value={build.levelRaw}
              height={8}
              tone="bg-accent"
              className="mt-1 max-w-[14rem]"
            />
            <span className="font-mono text-xs text-foreground-faint">
              {t("report.levelRaw")} {formatScore(build.levelRaw, 1)}
            </span>
          </div>

          <div className="flex items-center justify-center">
            <RadarChart
              size={248}
              axes={build.dimensions.map((dimension) => ({
                key: dimension.key,
                label: t(`dim.${dimension.key}`),
                value: dimension.score,
                tone: DIM_STROKE[dimension.key] ?? "var(--accent)",
              }))}
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Dimensions ──────────────────────────────────────────── */}
      <h3 className="mt-10 mb-4 font-display text-lg font-semibold tracking-tight">
        {t("report.dimensions")}
      </h3>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {build.dimensions.map((dimension) => (
          <Card key={dimension.key}>
            <CardHeader className="pb-3">
              <div className="flex items-baseline justify-between gap-3">
                <CardTitle className="flex items-center gap-2">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${DIM_DOT[dimension.key] ?? "bg-accent"}`}
                  />
                  {t(`dim.${dimension.key}`)}
                </CardTitle>
                <span className="font-mono text-sm font-semibold">
                  {formatScore(dimension.score, 1)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-foreground-subtle">
                <span>{t(`dimDesc.${dimension.key}`)}</span>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <StatBar
                value={dimension.score}
                tone={DIM_BAR[dimension.key] ?? "bg-accent"}
              />
              <div className="flex items-center justify-between font-mono text-[11px] text-foreground-faint">
                <span>
                  {t("report.weight")} {(dimension.weight * 100).toFixed(0)}%
                </span>
                <span>
                  {t("report.contribution")} {formatScore(dimension.contribution, 1)}
                </span>
              </div>

              {dimension.key !== "quality" && dimension.sub.length > 0 && (
                <div className="flex flex-col gap-2 border-t border-border pt-3">
                  {dimension.sub.map((metric) => (
                    <div key={metric.key} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-foreground-muted">
                          {t(`sub.${metric.key}`)}
                        </span>
                        <span className="font-mono text-foreground-subtle">
                          {metric.score === null
                            ? t("common.unknown")
                            : formatScore(metric.score, 1)}
                        </span>
                      </div>
                      <StatBar
                        value={metric.score ?? 0}
                        height={4}
                        muted={metric.score === null}
                        tone={DIM_BAR[dimension.key] ?? "bg-accent"}
                      />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Adjustments + attributes ────────────────────────────── */}
      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>{t("report.adjustments")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {build.adjustments.length === 0 ? (
              <p className="text-sm text-foreground-subtle">
                {t("report.noAdjustments")}
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {build.adjustments.map((adjustment) => (
                  <div
                    key={adjustment.key}
                    className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
                  >
                    <span className="text-sm">{t(`rule.${adjustment.key}`)}</span>
                    <span
                      className={`font-mono text-sm font-semibold ${
                        adjustment.delta > 0 ? "text-green-fg" : "text-red-fg"
                      }`}
                    >
                      {adjustment.delta > 0 ? "+" : ""}
                      {adjustment.delta}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between border-t border-border pt-3 text-xs text-foreground-subtle">
              <span>{t("report.totalBeforeRules")}</span>
              <span className="font-mono">{formatScore(baseScore, 1)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>{t("report.attributes")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {ATTRIBUTE_KEYS.map((key) => {
              const value = build.attributes[key];
              return (
                <div key={key} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="flex items-center gap-1.5 text-foreground-muted">
                      {t(`attr.${key}`)}
                      {value === null && (
                        <Info className="h-3 w-3 text-foreground-faint" aria-hidden="true" />
                      )}
                    </span>
                    <span className="font-mono text-foreground-subtle">
                      {value === null ? t("common.na") : formatScore(value, 1)}
                    </span>
                  </div>
                  <StatBar
                    value={value ?? 0}
                    height={5}
                    muted={value === null}
                    tone="bg-tone-slate"
                  />
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* ── Per-film scores ─────────────────────────────────────── */}
      <h3 className="mt-10 mb-4 font-display text-lg font-semibold tracking-tight">
        {t("report.films")}
      </h3>
      <Card>
        <CardContent className="flex flex-col gap-1 p-3 sm:p-4">
          {films.map((film, index) => {
            const movie = movies[index];
            const primary = displayTitle(movie, lang);
            const secondary = secondaryTitle(movie, lang);
            return (
              <button
                key={`${film.tmdbId}-${index}`}
                type="button"
                onClick={() => onOpenFilm(index)}
                className="flex items-center gap-3 rounded-md border border-transparent p-2 text-left transition-colors duration-base hover:border-border hover:bg-hover-bg"
              >
                <span className="w-10 shrink-0 sm:w-12">
                  <MoviePoster
                    posterPath={movie.posterPath}
                    title={primary}
                    size="w185"
                  />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{primary}</span>
                    {secondary && (
                      <span className="hidden truncate text-xs text-foreground-subtle sm:inline">
                        {secondary}
                      </span>
                    )}
                  </span>
                  <span className="flex flex-wrap items-center gap-2 text-xs text-foreground-subtle">
                    <span className="font-mono">{movie.year ?? "—"}</span>
                    <span className="truncate">{movie.director ?? "—"}</span>
                  </span>
                  <span className="mt-1 hidden grid-cols-4 gap-3 sm:grid">
                    {FILM_DIMENSIONS.map((key) => {
                      const dimension = findDimension(film, key);
                      return (
                        <span key={key} className="flex flex-col gap-1">
                          <span className="flex items-center justify-between font-mono text-[10px] text-foreground-faint">
                            <span className="truncate">{t(`dim.${key}`)}</span>
                            <span>
                              {dimension?.score === null || dimension === undefined
                                ? t("common.na")
                                : formatScore(dimension.score, 0)}
                            </span>
                          </span>
                          <StatBar
                            value={dimension?.score ?? 0}
                            height={3}
                            muted={!dimension || dimension.score === null}
                            tone={filmDimensionTone(key)}
                          />
                        </span>
                      );
                    })}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <span className="font-display text-lg leading-none font-bold">
                    {formatScore(film.total, 1)}
                  </span>
                  <span
                    className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ${TIER_CLASS[film.tier as Tier]}`}
                  >
                    {film.tier}
                  </span>
                </span>
                <ArrowUpRight
                  className="h-4 w-4 shrink-0 text-foreground-faint"
                  aria-hidden="true"
                />
              </button>
            );
          })}
        </CardContent>
      </Card>

      {/* ── Diagnostics ─────────────────────────────────────────── */}
      <h3 className="mt-10 mb-4 font-display text-lg font-semibold tracking-tight">
        {t("report.diagnostics")}
      </h3>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DiagnosticCard
          icon={<Layers className="h-3.5 w-3.5" aria-hidden="true" />}
          title={t("diag.eras")}
          value={String(diagnostics.eraBuckets)}
          chips={diagnostics.eraList.map((id) => eraLabel(id, lang))}
        />
        <DiagnosticCard
          icon={<Globe2 className="h-3.5 w-3.5" aria-hidden="true" />}
          title={t("diag.languages")}
          value={String(diagnostics.languages)}
          chips={diagnostics.languageList.map(
            (code) => languageName(code, lang) ?? code
          )}
        />
        <DiagnosticCard
          icon={<Factory className="h-3.5 w-3.5" aria-hidden="true" />}
          title={t("diag.regions")}
          value={String(diagnostics.regions)}
          chips={diagnostics.regionList.map((region) => t(`region.${region}`))}
        />
        <DiagnosticCard
          icon={<Users className="h-3.5 w-3.5" aria-hidden="true" />}
          title={t("diag.directors")}
          value={String(diagnostics.directors)}
          chips={diagnostics.directorList}
        />
        <DiagnosticCard
          icon={<Award className="h-3.5 w-3.5" aria-hidden="true" />}
          title={t("diag.genres")}
          value={String(diagnostics.genres)}
          chips={diagnostics.genreList.map((id) => genreName(Number(id), lang))}
        />
        <DiagnosticCard
          icon={<CircleSlash className="h-3.5 w-3.5" aria-hidden="true" />}
          title={t("diag.yearSpan")}
          value={t("diag.years", { n: diagnostics.yearSpan })}
          chips={
            diagnostics.yearMin !== null && diagnostics.yearMax !== null
              ? [`${diagnostics.yearMin} - ${diagnostics.yearMax}`]
              : []
          }
        />
      </div>
    </section>
  );
}

const ATTRIBUTE_KEYS = [
  "filmCriticism",
  "originality",
  "mainstreamPower",
  "buildCoherence",
  "historicalDepth",
  "awardsPrestige",
  "publicConsensus",
  "roastVulnerability",
];

function DiagnosticCard({
  icon,
  title,
  value,
  chips,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  chips: string[];
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-xs text-foreground-muted">
            {icon}
            {title}
          </span>
          <span className="font-display text-lg leading-none font-bold">{value}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {chips.length === 0 ? (
            <span className="text-xs text-foreground-faint">—</span>
          ) : (
            chips.map((chip) => (
              <span
                key={chip}
                className="rounded-full border border-border bg-hover-bg px-2 py-0.5 text-[11px] text-foreground-muted"
              >
                {chip}
              </span>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/** Compact raw-value readout reused by the film detail dialog. */
export function RawValue({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border py-2 last:border-b-0">
      <span className="text-xs text-foreground-muted">{label}</span>
      <span className={`font-mono text-xs ${tone ?? "text-foreground"}`}>{value}</span>
    </div>
  );
}
