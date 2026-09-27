import { searchAwardDataset, getAwardRecord, normalizeTitle } from "@/lib/awards";
import type { Lang } from "@/lib/i18n";
import {
  fetchBrief,
  fetchFilm,
  findTmdbByImdbId,
  isTmdbConfigured,
  searchTmdb,
  TmdbError,
} from "@/lib/tmdb";
export { posterUrl, TMDB_IMAGE_BASE } from "@/lib/media";
import type { MovieBrief, NormalizedFilm } from "@/lib/types";
import { isImdbIdQuery, isSearchableQuery } from "@/lib/search-query";
import demoSample from "@/data/demo-films.json";

/**
 * Film resolution layer.
 *
 * Chooses between live TMDB data and the bundled demo dataset so the app is
 * usable before `TMDB_API_KEY` is filled in, and so the algorithm's worked
 * example can be reproduced without network access.
 */

const demoFilms = demoSample as unknown as NormalizedFilm[];
const demoById = new Map<number, NormalizedFilm>(
  demoFilms.map((film) => [film.tmdbId, film])
);

export function isDemoId(tmdbId: number): boolean {
  return demoById.has(tmdbId);
}

export function demoFilmAsBrief(film: NormalizedFilm, lang: Lang): MovieBrief {
  return {
    tmdbId: film.tmdbId,
    title: film.title,
    titleZh: film.titleZh,
    originalTitle: film.originalTitle,
    year: film.year,
    posterPath: film.posterPath,
    tmdbRating: film.tmdbRating,
    overview: lang === "en" ? film.overview : null,
    overviewZh: lang === "zh" ? film.overviewZh : null,
    inAwardDataset: film.awards !== null,
    source: "demo",
  };
}

/**
 * Search the catalog for the movie picker.
 *
 * TMDB provides the primary results; the local award dataset is merged in so
 * that historically significant titles surface even when they are not
 * popularity leaders. Dataset-only hits are hydrated from TMDB when possible.
 */
export async function searchCatalog(
  query: string,
  lang: Lang
): Promise<{ results: MovieBrief[]; tmdbConfigured: boolean; degraded: boolean }> {
  const trimmed = query.trim();
  const tmdbConfigured = isTmdbConfigured();
  if (!isSearchableQuery(trimmed)) {
    return { results: [], tmdbConfigured, degraded: false };
  }

  // An IMDb identifier (tt…, at least 7 digits) is an exact lookup: hit
  // TMDB's /find endpoint and return the single match — no title search,
  // no award-dataset merge, no fuzzy ranking to get in the way.
  if (isImdbIdQuery(trimmed)) {
    if (!tmdbConfigured) {
      return { results: [], tmdbConfigured, degraded: true };
    }
    try {
      const brief = await findTmdbByImdbId(trimmed, lang);
      return { results: brief ? [brief] : [], tmdbConfigured, degraded: false };
    } catch (error) {
      if (error instanceof TmdbError) {
        return { results: [], tmdbConfigured, degraded: true };
      }
      throw error;
    }
  }

  if (!tmdbConfigured) {
    // Offline mode: match the demo sample and the award dataset titles.
    const needle = normalizeTitle(trimmed);
    const fromDemo = demoFilms
      .filter(
        (film) =>
          normalizeTitle(film.title).includes(needle) ||
          (film.titleZh ? film.titleZh.includes(trimmed) : false)
      )
      .map((film) => demoFilmAsBrief(film, lang));

    const fromDataset = searchAwardDataset(trimmed, 10)
      .filter((record) => !demoById.has(record.tmdb_id))
      .map<MovieBrief>((record) => ({
        tmdbId: record.tmdb_id,
        title: record.title,
        titleZh: null,
        originalTitle: record.title,
        year: null,
        posterPath: null,
        tmdbRating: null,
        overview: null,
        overviewZh: null,
        inAwardDataset: true,
        source: "demo",
      }));

    return {
      results: [...fromDemo, ...fromDataset],
      tmdbConfigured,
      degraded: true,
    };
  }

  let results: MovieBrief[] = [];
  try {
    results = await searchTmdb(trimmed, lang);
  } catch (error) {
    if (error instanceof TmdbError) {
      return { results: [], tmdbConfigured, degraded: true };
    }
    throw error;
  }

  // Merge in award-dataset titles that TMDB's ranking did not surface.
  const seen = new Set(results.map((r) => r.tmdbId));
  const extras = searchAwardDataset(trimmed, 6).filter(
    (record) => !seen.has(record.tmdb_id)
  );
  if (extras.length > 0) {
    const hydrated = await Promise.all(
      extras.slice(0, 4).map(async (record) => {
        const brief = await fetchBrief(record.tmdb_id, lang);
        return (
          brief ?? {
            tmdbId: record.tmdb_id,
            title: record.title,
            titleZh: null,
            originalTitle: record.title,
            year: null,
            posterPath: null,
            tmdbRating: null,
            overview: null,
            overviewZh: null,
            inAwardDataset: true,
            source: "tmdb" as const,
          }
        );
      })
    );
    for (const brief of hydrated) {
      if (!seen.has(brief.tmdbId)) {
        results.push({ ...brief, inAwardDataset: true });
        seen.add(brief.tmdbId);
      }
    }
  }

  return { results, tmdbConfigured, degraded: false };
}

/** Convert a TMDB search hit into the lightweight shape the UI caches. */
export function briefOf(film: NormalizedFilm, lang: Lang): MovieBrief {
  return {
    tmdbId: film.tmdbId,
    title: film.title,
    titleZh: film.titleZh,
    originalTitle: film.originalTitle,
    year: film.year,
    posterPath: film.posterPath,
    tmdbRating: film.tmdbRating,
    overview: lang === "en" ? film.overview : null,
    overviewZh: lang === "zh" ? film.overviewZh : null,
    inAwardDataset: getAwardRecord(film.tmdbId) !== null,
    source: film.source,
  };
}

/**
 * Resolve full film data for a set of TMDB ids, preserving request order.
 * Falls back to the bundled dataset when TMDB is not configured.
 */
export async function resolveFilms(tmdbIds: number[]): Promise<NormalizedFilm[]> {
  const offline = !isTmdbConfigured();

  const resolved = await Promise.all(
    tmdbIds.map(async (tmdbId) => {
      if (offline) {
        const demo = demoById.get(tmdbId);
        if (!demo) {
          throw new TmdbError(
            `Movie ${tmdbId} is not part of the bundled dataset`,
            "NOT_CONFIGURED"
          );
        }
        return demo;
      }
      return fetchFilm(tmdbId);
    })
  );

  return resolved;
}
