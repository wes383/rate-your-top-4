import type {
  DimensionKey,
  FilmDimension,
  FilmScore,
  NormalizedFilm,
  Tier,
} from "@/lib/types";
import { clamp, round } from "@/lib/utils";
import {
  AUDIENCE_IMDB_WEIGHT,
  AUDIENCE_TMDB_WEIGHT,
  AWARDS_BREADTH_WEIGHT,
  AWARDS_FESTIVAL_WEIGHT,
  AWARDS_OSCAR_WEIGHT,
  AWARD_BREADTH_PER_INSTITUTION,
  COLLECTION_PENALTY_ALL_SAME,
  COLLECTION_PENALTY_THREE_SAME,
  CONFIDENCE_POINTS,
  ERA_BUCKETS,
  FESTIVAL_MAX_POINTS,
  FESTIVAL_POINTS,
  FILM_TIER_THRESHOLDS,
  FOOTPRINT_IMDB_VOTES_MAX,
  FOOTPRINT_POPULARITY_MAX,
  FOOTPRINT_REVENUE_MAX,
  FOOTPRINT_TMDB_VOTES_MAX,
  IMDB_BAYESIAN_C,
  IMDB_BAYESIAN_M,
  IMDB_SCORE_FLOOR,
  IMDB_SCORE_RANGE,
  IMDB_STRENGTH_BAYES_WEIGHT,
  IMDB_STRENGTH_CREDIBILITY_WEIGHT,
  IMDB_VOTE_REFERENCE,
  LEGACY_MAX_POINTS,
  LEGACY_POINTS,
  LIST_LENGTH,
  MAX_REGIONS_PER_FILM,
  OSCAR_BEST_DIRECTOR_POINTS,
  OSCAR_BEST_PICTURE_POINTS,
  OSCAR_MAX_POINTS,
  OSCAR_OTHER_POINTS_CAP,
  OSCAR_OTHER_POINTS_PER_AWARD,
  OTHER_REGION,
  POPULARITY_REFERENCE,
  RANK_DECAY_FLOOR,
  REGION_MAP,
  REVENUE_REFERENCE,
  TMDB_VOTE_REFERENCE,
  TSPDT_21ST_CENTURY_FIRST_YEAR,
  WEIGHT_AUDIENCE,
  WEIGHT_AWARDS,
  WEIGHT_FOOTPRINT,
  WEIGHT_LEGACY,
} from "./constants";

/* ── Shared derivations used by both the film and build scorers ── */

/** Era bucket id for a release year. */
export function eraOf(year: number | null): string {
  if (year === null) return "unknown";
  const bucket = ERA_BUCKETS.find((b) => year >= b.min && year <= b.max);
  return bucket ? bucket.id : "unknown";
}

/** Macro-region for a production country code. */
export function regionOf(countryCode: string): string {
  return REGION_MAP[countryCode.toUpperCase()] ?? OTHER_REGION;
}

/**
 * Regions a film counts towards, capped at `MAX_REGIONS_PER_FILM` so that a
 * long co-production list cannot inflate regional diversity.
 */
export function regionsOf(film: NormalizedFilm): string[] {
  const seen: string[] = [];
  for (const country of film.countries) {
    const region = regionOf(country);
    if (!seen.includes(region)) seen.push(region);
    if (seen.length >= MAX_REGIONS_PER_FILM) break;
  }
  return seen.length > 0 ? seen : [OTHER_REGION];
}

/**
 * Rank → points mapping: rank 1 earns the full `maxPoints`, and the decay
 * bottoms out at `RANK_DECAY_FLOOR` of them — never at zero. Holding a floor
 * keeps placement meaningful (rank 1 is worth about 2.9x rank 1000 on the same
 * thousand-long list) while stopping a long list's tail from being flattened
 * to nothing. See RANK_DECAY_FLOOR for why that flattening mattered.
 */
function rankPoints(
  rank: number | null,
  maxPoints: number,
  listLength: number
): number {
  if (rank === null || !Number.isFinite(rank)) return 0;
  if (listLength <= 1) return 0;
  const clamped = clamp(rank, 1, listLength);
  const decay = (listLength - clamped) / (listLength - 1);
  return maxPoints * (RANK_DECAY_FLOOR + (1 - RANK_DECAY_FLOOR) * decay);
}

/**
 * Reads a list-rank field that may arrive as a number, a numeric string, or a
 * tie marker such as "并列". A tie carrying a digit ("并列第3") resolves to that
 * rank; one carrying no digit conveys no rank at all and resolves to null, so
 * it is treated as "not listed" instead of silently scoring against a rank we
 * never learned.
 */
function listRank(value: number | string | null | undefined): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const match = value.match(/\d+/);
    return match ? Number(match[0]) : null;
  }
  return null;
}

/** Non-negative log10 helper; missing / zero inputs return null. */
function logPts(value: number | null, reference: number, max: number) {
  if (value === null || value <= 0) return null;
  return clamp((max * Math.log10(1 + value)) / Math.log10(1 + reference), 0, max);
}

/** Tier from a score and a band table. */
export function tierFrom(
  total: number,
  thresholds: { S: number; A: number; B: number; C: number }
): Tier {
  if (total >= thresholds.S) return "S";
  if (total >= thresholds.A) return "A";
  if (total >= thresholds.B) return "B";
  if (total >= thresholds.C) return "C";
  return "F";
}

/** Tier of a single film score. Builds use their own band table. */
export function tierOf(total: number): Tier {
  return tierFrom(total, FILM_TIER_THRESHOLDS);
}

/* ── Dimension 1: audience rating ─────────────────────────────── */

interface AudienceComputation {
  score: number | null;
  metrics: Record<string, number | null>;
}

function computeAudience(film: NormalizedFilm): AudienceComputation {
  const hasImdb =
    film.imdbRating !== null &&
    film.imdbVotes !== null &&
    film.imdbVotes > 0;

  let weightedRating: number | null = null;
  let bayes: number | null = null;
  let credibility: number | null = null;
  let imdbStrength: number | null = null;

  if (hasImdb) {
    const v = film.imdbVotes as number;
    const r = film.imdbRating as number;
    weightedRating =
      (v / (v + IMDB_BAYESIAN_M)) * r +
      (IMDB_BAYESIAN_M / (v + IMDB_BAYESIAN_M)) * IMDB_BAYESIAN_C;
    bayes = clamp(
      (100 * (weightedRating - IMDB_SCORE_FLOOR)) / IMDB_SCORE_RANGE,
      0,
      100
    );
    credibility = clamp(
      (100 * Math.log10(1 + v)) / Math.log10(1 + IMDB_VOTE_REFERENCE),
      0,
      100
    );
    imdbStrength =
      IMDB_STRENGTH_BAYES_WEIGHT * bayes +
      IMDB_STRENGTH_CREDIBILITY_WEIGHT * credibility;
  }

  const tmdbScore =
    film.tmdbRating !== null ? clamp(film.tmdbRating * 10, 0, 100) : null;

  let score: number | null = null;
  if (imdbStrength !== null && tmdbScore !== null) {
    score =
      AUDIENCE_IMDB_WEIGHT * imdbStrength + AUDIENCE_TMDB_WEIGHT * tmdbScore;
  } else if (imdbStrength !== null) {
    score = imdbStrength;
  } else if (tmdbScore !== null) {
    score = tmdbScore;
  }

  return {
    score,
    metrics: {
      "audience.imdbRating": film.imdbRating,
      "audience.imdbVotes": film.imdbVotes,
      "audience.weightedRating": weightedRating,
      "audience.bayes": bayes,
      "audience.credibility": credibility,
      "audience.imdbStrength": imdbStrength,
      "audience.tmdbRating": film.tmdbRating,
      "audience.tmdbScore": tmdbScore,
    },
  };
}

/* ── Dimension 2: historical standing ────────────────────────── */

interface LegacyComputation {
  score: number | null;
  metrics: Record<string, number | null>;
}

function computeLegacy(film: NormalizedFilm): LegacyComputation {
  // Absence from the dataset is a verified NONE, not UNKNOWN. The dataset is
  // the reference for all four lists, so a film it does not carry was on none
  // of them. Treating it as UNKNOWN instead would drop the dimension from the
  // denominator and renormalise the remaining three — which made off-dataset
  // films outscore films that are listed but unranked, inverting the scale.
  const awards = film.awards;

  const tspdtTop1000 = rankPoints(
    awards?.tspdt_top_1000_rank ?? null,
    LEGACY_POINTS.tspdtTop1000,
    LIST_LENGTH.tspdtTop1000
  );
  const listRank21st = awards?.tspdt_21st_century_rank ?? null;
  // The 21st Century list starts in 2000, so a film verified to be older was
  // never able to be on it: the sub-item is UNKNOWN and its 6 points leave the
  // denominator. A missing release year is not enough to claim ineligibility,
  // so such a film keeps the full denominator. A listed film always counts,
  // and a 21st-century film merely absent from the list is a verified NONE.
  const canBeListed =
    film.year === null ||
    film.year >= TSPDT_21ST_CENTURY_FIRST_YEAR ||
    listRank21st !== null;
  const tspdt21stCentury = rankPoints(
    listRank21st,
    LEGACY_POINTS.tspdt21stCentury,
    LIST_LENGTH.tspdt21stCentury
  );
  const sightAndSound = rankPoints(
    awards?.sight_and_sound_2022_rank ?? null,
    LEGACY_POINTS.sightAndSoundCritics,
    LIST_LENGTH.sightAndSound
  );

  const cahiersRank = listRank(awards?.cahiers_top_10_rank);
  const cahiers = rankPoints(
    cahiersRank,
    LEGACY_POINTS.cahiersTop10,
    LIST_LENGTH.cahiersTop10
  );

  const raw = tspdtTop1000 + tspdt21stCentury + sightAndSound + cahiers;
  const maxPoints = canBeListed
    ? LEGACY_MAX_POINTS
    : LEGACY_MAX_POINTS - LEGACY_POINTS.tspdt21stCentury;

  return {
    score: clamp((100 * raw) / maxPoints, 0, 100),
    metrics: {
      "legacy.tspdtTop1000": tspdtTop1000,
      "legacy.tspdt21stCentury": tspdt21stCentury,
      "legacy.sightAndSound": sightAndSound,
      "legacy.cahiers": cahiers,
      "legacy.raw": raw,
      "legacy.maxPoints": maxPoints,
    },
  };
}

/* ── Dimension 3: awards ──────────────────────────────────────── */

interface AwardsComputation {
  score: number | null;
  metrics: Record<string, number | null>;
}

function computeAwards(film: NormalizedFilm): AwardsComputation {
  // Same rule as historical standing: a film absent from the dataset is a
  // verified NONE across the award fields, not an unknown quantity.
  const awards = film.awards;

  // Only wins count; nominations are deliberately ignored.
  const oscarRaw = Math.min(
    OSCAR_MAX_POINTS,
    (awards?.oscar_best_picture ? OSCAR_BEST_PICTURE_POINTS : 0) +
      (awards?.oscar_best_director ? OSCAR_BEST_DIRECTOR_POINTS : 0) +
      Math.min(
        OSCAR_OTHER_POINTS_CAP,
        (awards?.oscar_other_awards_count ?? 0) * OSCAR_OTHER_POINTS_PER_AWARD
      )
  );
  const oscar = clamp((100 * oscarRaw) / OSCAR_MAX_POINTS, 0, 100);

  const festivalRaw = Math.max(
    awards?.palme_d_or ? FESTIVAL_POINTS.palmeDOr : 0,
    awards?.golden_lion ? FESTIVAL_POINTS.goldenLion : 0,
    awards?.golden_bear ? FESTIVAL_POINTS.goldenBear : 0,
    awards?.cannes_grand_prix ? FESTIVAL_POINTS.cannesGrandPrix : 0,
    awards?.cannes_best_director ? FESTIVAL_POINTS.cannesBestDirector : 0,
    awards?.cannes_jury_prize ? FESTIVAL_POINTS.cannesJuryPrize : 0,
    awards?.venice_grand_jury_prize ? FESTIVAL_POINTS.veniceGrandJuryPrize : 0,
    awards?.berlinale_grand_jury_prize
      ? FESTIVAL_POINTS.berlinaleGrandJuryPrize
      : 0,
    awards?.berlinale_jury_prize ? FESTIVAL_POINTS.berlinaleJuryPrize : 0
  );
  const festival = clamp((100 * festivalRaw) / FESTIVAL_MAX_POINTS, 0, 100);

  // Breadth rewards coverage across institutions, never volume.
  const hasCannes = Boolean(
    awards?.palme_d_or ||
      awards?.cannes_grand_prix ||
      awards?.cannes_best_director ||
      awards?.cannes_jury_prize
  );
  const hasVenice = Boolean(
    awards?.golden_lion || awards?.venice_grand_jury_prize
  );
  const hasBerlin = Boolean(
    awards?.golden_bear ||
      awards?.berlinale_grand_jury_prize ||
      awards?.berlinale_jury_prize
  );
  const breadth =
    AWARD_BREADTH_PER_INSTITUTION *
    [oscarRaw > 0, hasCannes, hasVenice, hasBerlin].filter(Boolean).length;

  const score =
    AWARDS_OSCAR_WEIGHT * oscar +
    AWARDS_FESTIVAL_WEIGHT * festival +
    AWARDS_BREADTH_WEIGHT * breadth;

  return {
    score: clamp(score, 0, 100),
    metrics: {
      "awards.oscarRaw": oscarRaw,
      "awards.festivalRaw": festivalRaw,
      "awards.oscar": oscar,
      "awards.festival": festival,
      "awards.breadth": breadth,
    },
  };
}

/* ── Dimension 4: cultural footprint ──────────────────────────── */

interface FootprintComputation {
  score: number | null;
  metrics: Record<string, number | null>;
}

function computeFootprint(film: NormalizedFilm): FootprintComputation {
  const imdbVotePts = logPts(
    film.imdbVotes,
    IMDB_VOTE_REFERENCE,
    FOOTPRINT_IMDB_VOTES_MAX
  );
  const tmdbVotePts =
    film.tmdbVotes !== null && film.tmdbVotes > 0
      ? clamp(
          (FOOTPRINT_TMDB_VOTES_MAX * Math.log10(film.tmdbVotes)) /
            Math.log10(TMDB_VOTE_REFERENCE),
          0,
          FOOTPRINT_TMDB_VOTES_MAX
        )
      : null;
  const revenuePts = logPts(
    film.revenue && film.revenue > 0 ? film.revenue : null,
    REVENUE_REFERENCE,
    FOOTPRINT_REVENUE_MAX
  );
  const popularityPts =
    film.popularity !== null && film.popularity >= 0
      ? clamp(
          (FOOTPRINT_POPULARITY_MAX *
            Math.min(film.popularity / POPULARITY_REFERENCE, 1)) /
            1,
          0,
          FOOTPRINT_POPULARITY_MAX
        )
      : null;

  const parts = [imdbVotePts, tmdbVotePts, revenuePts, popularityPts];
  const available = parts.filter((p): p is number => p !== null);
  const maxAvailable =
    (imdbVotePts !== null ? FOOTPRINT_IMDB_VOTES_MAX : 0) +
    (tmdbVotePts !== null ? FOOTPRINT_TMDB_VOTES_MAX : 0) +
    (revenuePts !== null ? FOOTPRINT_REVENUE_MAX : 0) +
    (popularityPts !== null ? FOOTPRINT_POPULARITY_MAX : 0);

  const score =
    maxAvailable > 0
      ? clamp(
          (100 * available.reduce((a, b) => a + b, 0)) / maxAvailable,
          0,
          100
        )
      : null;

  return {
    score,
    metrics: {
      "footprint.imdbVotes": imdbVotePts,
      "footprint.tmdbVotes": tmdbVotePts,
      "footprint.revenue": revenuePts,
      "footprint.popularity": popularityPts,
    },
  };
}

/* ── Data confidence ──────────────────────────────────────────── */

export function filmConfidence(film: NormalizedFilm): number {
  let score = 0;
  if (film.imdbId) score += CONFIDENCE_POINTS.hasImdbId;
  if (
    film.imdbRating !== null &&
    film.imdbVotes !== null &&
    film.imdbVotes > 0
  ) {
    score += CONFIDENCE_POINTS.hasImdbRatingAndVotes;
  }
  if (film.genres.length > 0 && film.year !== null) {
    score += CONFIDENCE_POINTS.hasTmdbGenresAndYear;
  }
  if (film.director) score += CONFIDENCE_POINTS.hasDirector;
  if (film.awards) score += CONFIDENCE_POINTS.awardsVerified;
  return score;
}

/* ── Film score ───────────────────────────────────────────────── */

type DetailBag = Record<string, number | string | null>;

/** Raw inputs behind a dimension, surfaced by the transparency panel. */
function dimensionDetail(key: DimensionKey, film: NormalizedFilm): DetailBag {
  if (key === "audience") {
    return {
      imdbRating: film.imdbRating,
      imdbVotes: film.imdbVotes,
      tmdbRating: film.tmdbRating,
      tmdbVotes: film.tmdbVotes,
    };
  }
  if (key === "legacy") {
    return {
      tspdtTop1000: film.awards?.tspdt_top_1000_rank ?? null,
      tspdt21stCentury: film.awards?.tspdt_21st_century_rank ?? null,
      sightAndSound: film.awards?.sight_and_sound_2022_rank ?? null,
      cahiers: listRank(film.awards?.cahiers_top_10_rank),
    };
  }
  if (key === "awards") {
    return {
      bestPicture: film.awards?.oscar_best_picture ?? null,
      bestDirector: film.awards?.oscar_best_director ?? null,
      otherOscars: film.awards?.oscar_other_awards_count ?? null,
      palmeDOr: film.awards?.palme_d_or ?? null,
      goldenLion: film.awards?.golden_lion ?? null,
      goldenBear: film.awards?.golden_bear ?? null,
    };
  }
  return {
    imdbVotes: film.imdbVotes,
    tmdbVotes: film.tmdbVotes,
    revenue: film.revenue,
    popularity: film.popularity,
  };
}

/**
 * Score a single film on 0-100 as the weighted sum of four dimensions.
 *
 * Only audience and cultural footprint can be UNKNOWN; when they are, their
 * weight is redistributed proportionally so that missing data never
 * masquerades as a zero. Historical standing and awards are always scored:
 * the local dataset is complete enough that absence from it is itself the
 * verdict "on none of these lists, no major awards".
 */
export function scoreFilm(film: NormalizedFilm): FilmScore {
  const audience = computeAudience(film);
  const legacy = computeLegacy(film);
  const awards = computeAwards(film);
  const footprint = computeFootprint(film);

  const raw: { key: DimensionKey; score: number | null; weight: number }[] = [
    { key: "audience", score: audience.score, weight: WEIGHT_AUDIENCE },
    { key: "legacy", score: legacy.score, weight: WEIGHT_LEGACY },
    { key: "awards", score: awards.score, weight: WEIGHT_AWARDS },
    { key: "footprint", score: footprint.score, weight: WEIGHT_FOOTPRINT },
  ];

  const totalWeight = raw
    .filter((d) => d.score !== null)
    .reduce((acc, d) => acc + d.weight, 0);

  const dimensions: FilmDimension[] = raw.map((d) => {
    const effectiveWeight = d.score !== null && totalWeight > 0 ? d.weight / totalWeight : 0;
    return {
      key: d.key,
      score: d.score,
      weight: d.weight,
      effectiveWeight,
      contribution: d.score !== null ? d.score * effectiveWeight : 0,
      detail: dimensionDetail(d.key, film),
    };
  });

  const total = dimensions.reduce((acc, d) => acc + d.contribution, 0);

  const metrics: Record<string, number | null> = {
    ...audience.metrics,
    ...legacy.metrics,
    ...awards.metrics,
    ...footprint.metrics,
  };

  const missing: string[] = [];
  if (audience.metrics["audience.imdbStrength"] === null) missing.push("imdbRating");
  if (film.awards === null) missing.push("awardDataset");
  if (footprint.metrics["footprint.revenue"] === null) missing.push("revenue");
  if (film.keywords.length === 0) missing.push("keywords");

  // Recognition index: a single per-film visibility/prestige scalar used for
  // the spread term of the recognition-balance dimension.
  const recognitionParts: { value: number | null; weight: number }[] = [
    { value: audience.score, weight: 0.5 },
    { value: awards.score, weight: 0.3 },
    { value: footprint.score, weight: 0.2 },
  ];
  const recognitionWeight = recognitionParts
    .filter((p) => p.value !== null)
    .reduce((a, p) => a + p.weight, 0);
  const recognitionIndex =
    recognitionWeight > 0
      ? recognitionParts.reduce(
          (acc, p) => acc + (p.value ?? 0) * (p.value !== null ? p.weight : 0),
          0
        ) / recognitionWeight
      : 0;

  return {
    tmdbId: film.tmdbId,
    total: round(total, 1),
    tier: tierOf(total),
    dimensions,
    recognitionIndex: round(recognitionIndex, 2),
    confidence: filmConfidence(film),
    missing,
    metrics,
  };
}

/** Collection/franchise penalty shared by the variety dimension. */
export function collectionPenalty(collectionIds: (number | null)[]): number {
  const counts = new Map<number, number>();
  for (const id of collectionIds) {
    if (id === null) continue;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const max = Math.max(0, ...counts.values());
  if (max >= 4) return COLLECTION_PENALTY_ALL_SAME;
  if (max === 3) return COLLECTION_PENALTY_THREE_SAME;
  return 0;
}
