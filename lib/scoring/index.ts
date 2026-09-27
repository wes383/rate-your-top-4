/**
 * Scoring engine entry point.
 *
 * `scoreFilm` rates one movie 0-100; `scoreBuild` rates a Top 4 combination.
 * Both are pure functions over `NormalizedFilm`, so they can run on the server
 * (API routes) or be unit-tested directly.
 */

export * from "./constants";
export { eraOf, regionOf, regionsOf, tierOf, filmConfidence, collectionPenalty, scoreFilm } from "./film";
export { scoreBuild } from "./build";

import type { BuildResult, FilmScore, NormalizedFilm } from "@/lib/types";
import { scoreFilm } from "./film";
import { scoreBuild } from "./build";

/** Score four films and the build they form. */
export function analyzeBuild(films: NormalizedFilm[]): BuildResult & {
  movies: NormalizedFilm[];
} {
  const filmScores: FilmScore[] = films.map(scoreFilm);
  const result = scoreBuild(films, filmScores);
  return { ...result, movies: films };
}
