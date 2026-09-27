/**
 * Gate for firing a movie search. Two or more characters always count, and so
 * does a single CJK character — plenty of film titles are exactly one
 * character long in Chinese (《狗》《门》《.preview》), while a lone Latin
 * letter is still noise worth suppressing on every keystroke.
 */
export function isSearchableQuery(query: string): boolean {
  const trimmed = query.trim();
  if (trimmed.length >= 2) return true;
  if (trimmed.length === 0) return false;
  const code = trimmed.codePointAt(0) ?? 0;
  // U+3000-U+303F is CJK punctuation (《》。、) — not a title fragment.
  if (code >= 0x3000 && code <= 0x303f) return false;
  // U+2E80 and upward covers CJK radicals, kana, CJK unified ideographs and
  // hangul; Latin, Cyrillic, Arabic etc. stay below it.
  return code >= 0x2e80;
}

/**
 * IMDb identifier, e.g. tt0111161. The numeric part is at least seven digits
 * (older titles) and keeps growing as the catalog expands — newer IDs are
 * already eight digits — so the pattern is deliberately open-ended rather
 * than {7,8}.
 */
const IMDB_ID_PATTERN = /^tt\d{7,}$/i;

export function isImdbIdQuery(query: string): boolean {
  return IMDB_ID_PATTERN.test(query.trim());
}
