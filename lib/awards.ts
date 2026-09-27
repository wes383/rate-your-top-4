import type { AwardRecord } from "@/lib/types";
import { isSearchableQuery } from "@/lib/search-query";
import raw from "@/data/movies.json";

/**
 * Local award/ranking dataset (`data/movies.json`, 3.8k films).
 *
 * The dataset is the source of truth for the historical-standing and awards
 * dimensions. It is complete enough that absence is informative: a film that
 * is not here is scored as having been on none of the four lists and having
 * won no major award, not as an unknown. Only the fields a *present* record
 * zeroes out are counted as verified absences.
 */

const records = raw as AwardRecord[];

const byTmdbId = new Map<number, AwardRecord>();
for (const record of records) byTmdbId.set(record.tmdb_id, record);

/** Lowercase, strip punctuation and articles, and reorder "Title, The". */
export function normalizeTitle(title: string): string {
  const inverted = title.replace(/,\s*(the|a|an)\s*$/i, " $1");
  return inverted
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, " ")
    .trim();
}

const searchIndex = records.map((record) => ({
  record,
  key: normalizeTitle(record.title),
}));

export function getAwardRecord(tmdbId: number): AwardRecord | null {
  return byTmdbId.get(tmdbId) ?? null;
}

export function hasAwardRecord(tmdbId: number): boolean {
  return byTmdbId.has(tmdbId);
}

export function awardDatasetSize(): number {
  return records.length;
}

/**
 * Title search over the local dataset. Prefix matches rank first, then
 * substring matches, each ordered by how much historical recognition the film
 * has so the most meaningful entries surface first.
 */
export function searchAwardDataset(query: string, limit = 6): AwardRecord[] {
  const needle = normalizeTitle(query);
  if (!isSearchableQuery(needle)) return [];

  const scored: { record: AwardRecord; rank: number; score: number }[] = [];
  for (const { record, key } of searchIndex) {
    let rank: number;
    if (key === needle) rank = 0;
    else if (key.startsWith(`${needle} `) || key.startsWith(needle)) rank = 1;
    else if (key.includes(` ${needle}`)) rank = 2;
    else continue;
    scored.push({ record, rank, score: recognitionWeight(record) });
  }

  scored.sort((a, b) => a.rank - b.rank || b.score - a.score);
  return scored.slice(0, limit).map((s) => s.record);
}

/** Cheap proxy for how historically significant a dataset entry is. */
function recognitionWeight(record: AwardRecord): number {
  const tspdt =
    record.tspdt_top_1000_rank !== null
      ? (1000 - record.tspdt_top_1000_rank) / 100
      : 0;
  const tspdt21 =
    record.tspdt_21st_century_rank !== null
      ? (1000 - record.tspdt_21st_century_rank) / 200
      : 0;
  const oscar =
    (record.oscar_best_picture ? 6 : 0) +
    (record.oscar_best_director ? 4 : 0) +
    Math.min(record.oscar_other_awards_count, 4);
  const festival =
    (record.palme_d_or ? 6 : 0) +
    (record.golden_lion ? 5 : 0) +
    (record.golden_bear ? 4 : 0) +
    (record.cannes_grand_prix ? 3 : 0) +
    (record.cannes_best_director ? 2 : 0) +
    (record.cannes_jury_prize ? 2 : 0) +
    (record.berlinale_jury_prize ? 1 : 0);
  return tspdt + tspdt21 + oscar + festival;
}
