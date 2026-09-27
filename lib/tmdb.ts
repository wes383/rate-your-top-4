import { createCache } from "@/lib/cache";
import { getAwardRecord } from "@/lib/awards";
import { getImdbRating } from "@/lib/imdb";
import type { Lang } from "@/lib/i18n";
import type { Genre, Keyword, MovieBrief, NormalizedFilm } from "@/lib/types";
import { isSearchableQuery } from "@/lib/search-query";

/**
 * TMDB client.
 *
 * Credentials are read from the environment and are intentionally never
 * exposed to the browser: every call happens in a route handler. Both auth
 * styles are supported — a v3 API key (`TMDB_API_KEY`) or a v4 bearer token
 * (`TMDB_ACCESS_TOKEN`).
 */

const API_BASE = "https://api.themoviedb.org/3";

const TIMEOUT_MS = 10_000;
const FILM_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SEARCH_TTL_MS = 60 * 60 * 1000;

const filmCache = createCache<NormalizedFilm>("tmdb-films", FILM_TTL_MS);
const searchCache = createCache<MovieBrief[]>("tmdb-search", SEARCH_TTL_MS);

/**
 * Reads a credential from the environment, tolerating stray whitespace.
 * Windows editors commonly save `.env` with CRLF endings, which would
 * otherwise leave a trailing `\r` inside the key and produce a confusing 401.
 */
function credential(name: "TMDB_API_KEY" | "TMDB_ACCESS_TOKEN"): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

export function isTmdbConfigured(): boolean {
  return credential("TMDB_API_KEY") !== null || credential("TMDB_ACCESS_TOKEN") !== null;
}

export class TmdbError extends Error {
  constructor(
    message: string,
    readonly code: "NOT_CONFIGURED" | "NOT_FOUND" | "UPSTREAM" | "NETWORK"
  ) {
    super(message);
    this.name = "TmdbError";
  }
}

function authHeaders(): Record<string, string> {
  const token = credential("TMDB_ACCESS_TOKEN");
  return token
    ? { accept: "application/json", authorization: `Bearer ${token}` }
    : { accept: "application/json" };
}

async function tmdbGet<T>(
  path: string,
  params: Record<string, string | number | undefined> = {}
): Promise<T> {
  if (!isTmdbConfigured()) {
    throw new TmdbError("TMDB credentials are not configured", "NOT_CONFIGURED");
  }

  const url = new URL(`${API_BASE}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  // v3 key goes in the query string; a v4 token goes in the header.
  const token = credential("TMDB_ACCESS_TOKEN");
  const apiKey = credential("TMDB_API_KEY");
  if (!token && apiKey) {
    url.searchParams.set("api_key", apiKey);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      headers: authHeaders(),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error) {
    throw new TmdbError(
      error instanceof Error ? error.message : "TMDB request failed",
      "NETWORK"
    );
  }

  if (response.status === 404) {
    throw new TmdbError("Movie not found on TMDB", "NOT_FOUND");
  }
  if (!response.ok) {
    throw new TmdbError(
      `TMDB responded with ${response.status}`,
      "UPSTREAM"
    );
  }
  return (await response.json()) as T;
}

/* ── Raw TMDB payload shapes (only the fields we consume) ─────── */

interface TmdbMovie {
  id: number;
  title?: string;
  original_title?: string;
  name?: string;
  overview?: string;
  release_date?: string;
  runtime?: number | null;
  poster_path?: string | null;
  revenue?: number;
  popularity?: number;
  vote_average?: number;
  vote_count?: number;
  original_language?: string;
  genres?: { id: number; name: string }[];
  production_companies?: { id: number; name: string }[];
  production_countries?: { iso_3166_1: string; name: string }[];
  belongs_to_collection?: { id: number; name: string } | null;
  imdb_id?: string | null;
  credits?: {
    crew?: { id: number; name: string; job?: string }[];
    cast?: { id: number; name: string }[];
  };
  keywords?: { keywords?: { id: number; name: string }[] };
  external_ids?: { imdb_id?: string | null };
}

interface TmdbSearchPayload {
  results?: TmdbMovie[];
}

interface TmdbFindPayload {
  movie_results?: TmdbMovie[];
}

function yearOf(releaseDate: string | undefined | null): number | null {
  if (!releaseDate) return null;
  const match = /^(\d{4})/.exec(releaseDate);
  return match ? Number(match[1]) : null;
}

function isEmpty(value: number | null | undefined): boolean {
  return value === null || value === undefined || !Number.isFinite(value);
}

/* ── Search ───────────────────────────────────────────────────── */

/** Shared TMDB-movie → search-result mapping (title pass localized). */
function toBrief(movie: TmdbMovie, lang: Lang): MovieBrief {
  return {
    tmdbId: movie.id,
    title: movie.title ?? movie.name ?? "",
    titleZh: lang === "zh" ? (movie.title ?? null) : null,
    originalTitle: movie.original_title ?? null,
    year: yearOf(movie.release_date),
    posterPath: movie.poster_path ?? null,
    tmdbRating: isEmpty(movie.vote_average)
      ? null
      : (movie.vote_average as number),
    overview: lang === "en" ? (movie.overview ?? null) : null,
    overviewZh: lang === "zh" ? (movie.overview ?? null) : null,
    inAwardDataset: getAwardRecord(movie.id) !== null,
    source: "tmdb",
  };
}

export async function searchTmdb(
  query: string,
  lang: Lang
): Promise<MovieBrief[]> {
  const trimmed = query.trim();
  if (!isSearchableQuery(trimmed)) return [];

  const cacheKey = `${lang}:${trimmed.toLowerCase()}`;
  const cached = searchCache.get(cacheKey);
  if (cached) return cached;

  const payload = await tmdbGet<TmdbSearchPayload>("/search/movie", {
    query: trimmed,
    language: lang === "zh" ? "zh-CN" : "en-US",
    include_adult: "false",
    page: 1,
  });

  const results = (payload.results ?? [])
    .filter((movie) => movie.id && (movie.title || movie.name))
    .slice(0, 12)
    .map<MovieBrief>((movie) => toBrief(movie, lang));

  searchCache.set(cacheKey, results);
  return results;
}

/**
 * Exact lookup by IMDb identifier via TMDB's /find endpoint. Returns null
 * when the ID is unknown; NOT_FOUND from the upstream is a normal miss, not
 * an error condition for the caller.
 */
export async function findTmdbByImdbId(
  imdbId: string,
  lang: Lang
): Promise<MovieBrief | null> {
  const normalized = imdbId.trim().toLowerCase();
  const cacheKey = `imdb:${lang}:${normalized}`;
  const cached = searchCache.get(cacheKey);
  if (cached) return cached[0] ?? null;

  let payload: TmdbFindPayload;
  try {
    payload = await tmdbGet<TmdbFindPayload>(`/find/${normalized}`, {
      external_source: "imdb_id",
      language: lang === "zh" ? "zh-CN" : "en-US",
    });
  } catch (error) {
    if (error instanceof TmdbError && error.code === "NOT_FOUND") return null;
    throw error;
  }

  const movie = (payload.movie_results ?? []).find(
    (candidate) => candidate.id && (candidate.title || candidate.name)
  );
  if (!movie) return null;

  const brief = toBrief(movie, lang);
  searchCache.set(cacheKey, [brief]);
  return brief;
}

/** Minimal TMDB detail lookup used to hydrate award-dataset search hits. */
export async function fetchBrief(
  tmdbId: number,
  lang: Lang
): Promise<MovieBrief | null> {
  try {
    const movie = await tmdbGet<TmdbMovie>(`/movie/${tmdbId}`, {
      language: lang === "zh" ? "zh-CN" : "en-US",
    });
    return {
      tmdbId,
      title: movie.title ?? movie.name ?? "",
      titleZh: lang === "zh" ? (movie.title ?? null) : null,
      originalTitle: movie.original_title ?? null,
      year: yearOf(movie.release_date),
      posterPath: movie.poster_path ?? null,
      tmdbRating: isEmpty(movie.vote_average)
        ? null
        : (movie.vote_average as number),
      overview: lang === "en" ? (movie.overview ?? null) : null,
      overviewZh: lang === "zh" ? (movie.overview ?? null) : null,
      inAwardDataset: getAwardRecord(tmdbId) !== null,
      source: "tmdb",
    };
  } catch {
    return null;
  }
}

/* ── Full film lookup ─────────────────────────────────────────── */

/**
 * Load every scoring-relevant field for a movie: TMDB details in English plus
 * a Chinese title/overview pass, the local award record, and the IMDb rating.
 */
export async function fetchFilm(tmdbId: number): Promise<NormalizedFilm> {
  const cached = filmCache.get(String(tmdbId));
  if (cached) return cached;

  const query = {
    append_to_response: "credits,keywords,external_ids",
  };

  const [enResult, zh] = await Promise.all([
    tmdbGet<TmdbMovie>(`/movie/${tmdbId}`, { ...query, language: "en-US" }),
    tmdbGet<TmdbMovie>(`/movie/${tmdbId}`, { language: "zh-CN" }).catch(
      () => null
    ),
  ]);

  const imdbId = enResult.imdb_id ?? enResult.external_ids?.imdb_id ?? null;
  const imdb = await getImdbRating(imdbId);

  const director =
    enResult.credits?.crew?.find((member) => member.job === "Director") ??
    null;

  const film: NormalizedFilm = {
    tmdbId,
    imdbId,
    originalTitle: enResult.original_title ?? null,
    title: enResult.title ?? enResult.name ?? "",
    titleZh: zh?.title ?? null,
    overview: enResult.overview ?? null,
    overviewZh: zh?.overview ?? null,
    releaseDate: enResult.release_date ?? null,
    year: yearOf(enResult.release_date),
    runtime: isEmpty(enResult.runtime) ? null : (enResult.runtime as number),
    posterPath: enResult.poster_path ?? null,
    genres: (enResult.genres ?? []).map<Genre>((g) => ({
      id: g.id,
      name: g.name,
    })),
    keywords: (enResult.keywords?.keywords ?? []).map<Keyword>((k) => ({
      id: k.id,
      name: k.name,
    })),
    director: director?.name ?? null,
    directorId: director?.id ?? null,
    companies: (enResult.production_companies ?? [])
      .slice(0, 10)
      .map((c) => ({ id: c.id, name: c.name })),
    countries: (enResult.production_countries ?? []).map((c) => c.iso_3166_1),
    originalLanguage: enResult.original_language ?? null,
    collection: enResult.belongs_to_collection
      ? {
          id: enResult.belongs_to_collection.id,
          name: enResult.belongs_to_collection.name,
        }
      : null,
    revenue: isEmpty(enResult.revenue) ? null : (enResult.revenue as number),
    popularity: isEmpty(enResult.popularity)
      ? null
      : (enResult.popularity as number),
    tmdbRating: isEmpty(enResult.vote_average)
      ? null
      : (enResult.vote_average as number),
    tmdbVotes: isEmpty(enResult.vote_count)
      ? null
      : (enResult.vote_count as number),
    imdbRating: imdb?.rating ?? null,
    imdbVotes: imdb?.numVotes ?? null,
    awards: getAwardRecord(tmdbId),
    source: "tmdb",
  };

  filmCache.set(String(tmdbId), film);
  return film;
}
