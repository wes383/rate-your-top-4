/** Client-safe media helpers (no Node built-ins, safe to import in components). */

export const TMDB_IMAGE_BASE =
  process.env.NEXT_PUBLIC_TMDB_IMAGE_BASE || "https://image.tmdb.org/t/p";

export type PosterSize = "w185" | "w342" | "w500" | "original";

/** Build a full poster URL from a TMDB `poster_path`, or null when absent. */
export function posterUrl(
  posterPath: string | null | undefined,
  size: PosterSize = "w342"
): string | null {
  if (!posterPath) return null;
  return `${TMDB_IMAGE_BASE}/${size}${posterPath}`;
}
