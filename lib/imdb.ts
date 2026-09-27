import { createCache } from "@/lib/cache";

/**
 * IMDb rating client.
 *
 * Ratings come from a small public JSON endpoint rather than the official
 * IMDb API, because only the rating and vote count are needed. Results are
 * cached for a day: ratings move slowly and the endpoint is rate-limited.
 */

const DEFAULT_ENDPOINT =
  "https://imdb-ratings-ten.vercel.app/api/rating";

const ENDPOINT = process.env.IMDB_RATINGS_API_URL || DEFAULT_ENDPOINT;
const TIMEOUT_MS = 8_000;
const TTL_MS = 24 * 60 * 60 * 1000;

export interface ImdbRating {
  imdbId: string;
  rating: number;
  numVotes: number;
  updatedAt: string | null;
}

const cache = createCache<ImdbRating | null>("imdb-ratings", TTL_MS);

export function isImdbConfigured(): boolean {
  return Boolean(ENDPOINT);
}

/** Fetch the IMDb rating for one id, or null when unavailable. */
export async function getImdbRating(
  imdbId: string | null
): Promise<ImdbRating | null> {
  if (!imdbId || !/^tt\d+$/.test(imdbId)) return null;
  if (!ENDPOINT) return null;

  const cached = cache.get(imdbId);
  if (cached !== undefined) return cached;

  try {
    const response = await fetch(
      `${ENDPOINT}?imdbId=${encodeURIComponent(imdbId)}`,
      {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { accept: "application/json" },
        cache: "no-store",
      }
    );
    if (!response.ok) {
      cache.set(imdbId, null);
      return null;
    }
    const payload = (await response.json()) as Partial<ImdbRating>;
    const rating =
      typeof payload.rating === "number" && Number.isFinite(payload.rating)
        ? payload.rating
        : null;
    const numVotes =
      typeof payload.numVotes === "number" && Number.isFinite(payload.numVotes)
        ? payload.numVotes
        : null;

    if (rating === null || numVotes === null) {
      cache.set(imdbId, null);
      return null;
    }

    const value: ImdbRating = {
      imdbId,
      rating,
      numVotes,
      updatedAt: payload.updatedAt ?? null,
    };
    cache.set(imdbId, value);
    return value;
  } catch {
    // Network error or timeout: leave uncached so the next request retries.
    return null;
  }
}
