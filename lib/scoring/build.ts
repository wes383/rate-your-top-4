import type {
  BuildDimension,
  BuildDiagnostics,
  BuildResult,
  FilmScore,
  Metric,
  NormalizedFilm,
  RuleAdjustment,
  Tier,
} from "@/lib/types";
import {
  clamp,
  jaccardSimilarity,
  mean,
  meanOverPairs,
  round,
  shannonEntropy,
  stdDev,
} from "@/lib/utils";
import {
  BUILD_TIER_THRESHOLDS,
  BUILD_WEIGHTS,
  COHERENCE_FLOOR_CLUSTERED,
  COHERENCE_FLOOR_DISPARATE,
  COHERENCE_PEAK,
  COHERENCE_WEIGHTS,
  COLLECTION_PENALTY_ALL_SAME,
  COMPANY_OVERLAP_PENALTY,
  CONFIDENCE_BANDS,
  CREATOR_COMPANY_WEIGHT,
  CREATOR_DIRECTOR_WEIGHT,
  DIRECTOR_OVERLAP_THRESHOLD,
  DIRECTOR_SIGNATURE,
  ERA_ENTROPY_WEIGHT,
  ERA_FULL_SPAN,
  ERA_SPAN_WEIGHT,
  FILM_CRITICISM_WEIGHTS,
  FOOTPRINT_SPREAD_REFERENCE,
  GENRE_CONCENTRATION_BASELINE,
  GENRE_IDENTITY_CAP,
  HISTORICAL_DEPTH_WEIGHTS,
  IDENTITY_WEIGHTS,
  LANGUAGE_REGION_LANGUAGE_WEIGHT,
  LANGUAGE_REGION_REGION_WEIGHT,
  LEVEL_BANDS,
  LEVEL_WEIGHTS,
  RARE_FEATURE_PER_SIGNAL,
  RECOGNITION_SPREAD_MULTIPLIER,
  RECOGNITION_WEIGHTS,
  ROAST_VULNERABILITY_WEIGHTS,
  RULE_DELTAS,
  RULE_DISTRIBUTED_RECOGNITION,
  RULE_NARROW_GENRE_MAX_TYPES,
  RULE_TRIPLE_COVERAGE,
  VARIETY_WEIGHTS,
} from "./constants";
import { collectionPenalty, eraOf, regionsOf, tierFrom } from "./film";
import { detectSchools } from "./schools";

/** Everything the build scorer needs to know about one film. */
interface Traits {
  tmdbId: number;
  year: number | null;
  era: string;
  language: string | null;
  regions: string[];
  genreIds: number[];
  keywordIds: number[];
  director: string | null;
  companyIds: number[];
  collectionId: number | null;
}

function traitsOf(film: NormalizedFilm): Traits {
  return {
    tmdbId: film.tmdbId,
    year: film.year,
    era: eraOf(film.year),
    language: film.originalLanguage,
    regions: regionsOf(film),
    genreIds: film.genres.map((g) => g.id),
    keywordIds: film.keywords.map((k) => k.id),
    director: film.director,
    companyIds: film.companies.map((c) => c.id),
    collectionId: film.collection?.id ?? null,
  };
}

/** Number of distinct values, ignoring nulls. */
function distinctCount(values: (string | number | null)[]): number {
  return new Set(values.filter((v) => v !== null)).size;
}

/** Percentage of duplicated company credits across the build. */
function companyOverlapRate(traits: Traits[]): number {
  const all = traits.flatMap((t) => t.companyIds);
  if (all.length === 0) return 0;
  const distinct = new Set(all).size;
  return (all.length - distinct) / all.length;
}

/** Largest number of films credited to a single director. */
function maxDirectorRepeat(traits: Traits[]): number {
  const counts = new Map<string, number>();
  for (const t of traits) {
    if (!t.director) continue;
    counts.set(t.director, (counts.get(t.director) ?? 0) + 1);
  }
  return Math.max(0, ...counts.values());
}

/* ── Variety ──────────────────────────────────────────────────── */

function computeEraDiversity(years: number[]): {
  score: number;
  eraEntropy: number;
  span: number;
} {
  if (years.length === 0) {
    return { score: 0, eraEntropy: 0, span: 0 };
  }
  const counts = new Map<string, number>();
  for (const y of years) {
    const era = eraOf(y);
    counts.set(era, (counts.get(era) ?? 0) + 1);
  }
  const entropy = shannonEntropy([...counts.values()], years.length);
  // Normalised by ln(4): 4 films spread across 4 distinct eras reach 100.
  const eraEntropy = clamp((100 * entropy) / Math.log(4), 0, 100);
  const span = clamp(
    (Math.max(...years) - Math.min(...years)) / ERA_FULL_SPAN,
    0,
    1
  );
  const score =
    ERA_ENTROPY_WEIGHT * eraEntropy + ERA_SPAN_WEIGHT * span * 100;
  return { score: clamp(score, 0, 100), eraEntropy, span: span * 100 };
}

function diversityFromCounts(
  values: (string | null)[],
  total: number
): number {
  if (total === 0) return 0;
  const counts = new Map<string, number>();
  for (const v of values) {
    if (v === null) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  const entropy = shannonEntropy([...counts.values()], total);
  return clamp((100 * entropy) / Math.log(4), 0, 100);
}

interface VarietyResult {
  score: number;
  sub: Metric[];
}

function computeVariety(traits: Traits[], years: number[]): VarietyResult {
  const n = traits.length;
  const { score: eraScore, eraEntropy, span } = computeEraDiversity(years);
  const languageDiversity = diversityFromCounts(
    traits.map((t) => t.language),
    n
  );
  // Co-productions contribute up to MAX_REGIONS_PER_FILM regions, so the
  // distribution is taken over region assignments rather than over films.
  const allRegions = traits.flatMap((t) => t.regions);
  const regionDiversity = diversityFromCounts(allRegions, allRegions.length);
  const languageRegion =
    LANGUAGE_REGION_LANGUAGE_WEIGHT * languageDiversity +
    LANGUAGE_REGION_REGION_WEIGHT * regionDiversity;

  const genreDiversity =
    100 *
    meanOverPairs(traits, (a, b) => 1 - jaccardSimilarity(a.genreIds, b.genreIds));

  const directorCount = distinctCount(traits.map((t) => t.director));
  const directorDiversity = clamp((100 * (directorCount - 1)) / 3, 0, 100);

  const penalty = collectionPenalty(traits.map((t) => t.collectionId));
  const overlap = companyOverlapRate(traits);
  const collection = clamp(
    100 - penalty - COMPANY_OVERLAP_PENALTY * overlap,
    0,
    100
  );

  const score =
    VARIETY_WEIGHTS.era * eraScore +
    VARIETY_WEIGHTS.languageRegion * languageRegion +
    VARIETY_WEIGHTS.genre * genreDiversity +
    VARIETY_WEIGHTS.director * directorDiversity +
    VARIETY_WEIGHTS.collection * collection;

  return {
    score: clamp(score, 0, 100),
    sub: [
      {
        key: "era",
        score: round(eraScore, 1),
        detail: {
          entropy: round(eraEntropy, 1),
          span: round(span, 1),
          distinctEras: distinctCount(traits.map((t) => t.era)),
        },
      },
      {
        key: "languageRegion",
        score: round(languageRegion, 1),
        detail: {
          languageDiversity: round(languageDiversity, 1),
          regionDiversity: round(regionDiversity, 1),
          distinctLanguages: distinctCount(traits.map((t) => t.language)),
          distinctRegions: distinctCount(traits.flatMap((t) => t.regions)),
        },
      },
      {
        key: "genre",
        score: round(genreDiversity, 1),
        detail: {
          distinctGenres: distinctCount(traits.flatMap((t) => t.genreIds)),
        },
      },
      {
        key: "director",
        score: round(directorDiversity, 1),
        detail: { distinctDirectors: directorCount },
      },
      {
        key: "collection",
        score: round(collection, 1),
        detail: {
          collectionPenalty: penalty,
          companyOverlap: round(overlap * 100, 1),
        },
      },
    ],
  };
}

/* ── Coherence ────────────────────────────────────────────────── */

interface CoherenceResult {
  score: number;
  /** Blended raw affinity behind the score, 0-100. */
  affinity: number;
  sub: Metric[];
  keywordAvailable: boolean;
}

/**
 * Map a blended affinity onto the coherence score.
 *
 * Two straight lines meeting at `COHERENCE_PEAK`: rising from
 * `COHERENCE_FLOOR_DISPARATE` for builds with little in common, falling to
 * `COHERENCE_FLOOR_CLUSTERED` for builds whose films repeat each other.
 */
function coherenceFromAffinity(affinity: number): number {
  if (affinity <= COHERENCE_PEAK) {
    return (
      COHERENCE_FLOOR_DISPARATE +
      ((100 - COHERENCE_FLOOR_DISPARATE) * affinity) / COHERENCE_PEAK
    );
  }
  return (
    100 -
    ((100 - COHERENCE_FLOOR_CLUSTERED) * (affinity - COHERENCE_PEAK)) /
      (100 - COHERENCE_PEAK)
  );
}

function computeCoherence(traits: Traits[]): CoherenceResult {
  const genreAffinity =
    100 *
    meanOverPairs(traits, (a, b) => jaccardSimilarity(a.genreIds, b.genreIds));

  const keywordAvailable = traits.some((t) => t.keywordIds.length > 0);
  const keywordAffinity = keywordAvailable
    ? 100 *
      meanOverPairs(traits, (a, b) =>
        jaccardSimilarity(a.keywordIds, b.keywordIds)
      )
    : null;

  const repeat = maxDirectorRepeat(traits);
  const directorRepeat = clamp((repeat - 1) / 3, 0, 1);
  const sharedCompanyRate = companyOverlapRate(traits);
  const creatorAffinity =
    100 *
    (CREATOR_DIRECTOR_WEIGHT * directorRepeat +
      CREATOR_COMPANY_WEIGHT * sharedCompanyRate);

  const yearPairs: number[] = [];
  for (let i = 0; i < traits.length; i += 1) {
    for (let j = i + 1; j < traits.length; j += 1) {
      const a = traits[i].year;
      const b = traits[j].year;
      if (a === null || b === null) continue;
      yearPairs.push(clamp(1 - Math.abs(a - b) / ERA_FULL_SPAN, 0, 1));
    }
  }
  const eraAffinity =
    yearPairs.length > 0 ? 100 * (mean(yearPairs) as number) : null;

  const parts: { value: number | null; weight: number }[] = [
    { value: genreAffinity, weight: COHERENCE_WEIGHTS.genreAffinity },
    { value: keywordAffinity, weight: COHERENCE_WEIGHTS.keywordAffinity },
    { value: creatorAffinity, weight: COHERENCE_WEIGHTS.creatorAffinity },
    { value: eraAffinity, weight: COHERENCE_WEIGHTS.eraAffinity },
  ];
  const totalWeight = parts
    .filter((p) => p.value !== null)
    .reduce((acc, p) => acc + p.weight, 0);
  const affinity =
    totalWeight > 0
      ? parts.reduce(
          (acc, p) => acc + (p.value ?? 0) * (p.value !== null ? p.weight : 0),
          0
        ) / totalWeight
      : 0;

  const score = coherenceFromAffinity(affinity);

  return {
    score: clamp(score, 0, 100),
    affinity,
    keywordAvailable,
    sub: [
      {
        key: "affinity",
        score: round(affinity, 1),
        detail: { peak: COHERENCE_PEAK },
      },
      { key: "genreAffinity", score: round(genreAffinity, 1) },
      {
        key: "keywordAffinity",
        score: keywordAffinity === null ? null : round(keywordAffinity, 1),
        detail: { available: keywordAvailable ? 1 : 0 },
      },
      {
        key: "creatorAffinity",
        score: round(creatorAffinity, 1),
        detail: {
          directorRepeat: round(directorRepeat * 100, 1),
          sharedCompanyRate: round(sharedCompanyRate * 100, 1),
        },
      },
      {
        key: "eraAffinity",
        score: eraAffinity === null ? null : round(eraAffinity, 1),
      },
    ],
  };
}

/* ── Identity ─────────────────────────────────────────────────── */

interface IdentityResult {
  score: number;
  sub: Metric[];
}

/** True when at least one value of `values` occurs in exactly one film. */
function hasUniqueValue(values: (string | number | null)[]): boolean {
  const counts = new Map<string, number>();
  for (const v of values) {
    if (v === null) continue;
    const key = String(v);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.values()].some((c) => c === 1);
}

function computeIdentity(
  traits: Traits[],
  genreAffinity: number,
  keywordAffinity: number | null,
  footprintScores: number[]
): IdentityResult {
  const allGenres = traits.flatMap((t) => t.genreIds);
  let genreIdentity: number | null = null;
  if (allGenres.length > 0) {
    const counts = new Map<number, number>();
    for (const g of allGenres) counts.set(g, (counts.get(g) ?? 0) + 1);
    const hhi = [...counts.values()].reduce(
      (acc, c) => acc + (c / allGenres.length) ** 2,
      0
    );
    genreIdentity = Math.min(
      GENRE_IDENTITY_CAP,
      100 * 2 * Math.abs(hhi - GENRE_CONCENTRATION_BASELINE)
    );
  }

  const repeat = maxDirectorRepeat(traits);
  const directorCount = distinctCount(traits.map((t) => t.director));
  const overlapSignal =
    genreAffinity >= DIRECTOR_OVERLAP_THRESHOLD ||
    (keywordAffinity ?? 0) >= DIRECTOR_OVERLAP_THRESHOLD;
  let directorSignature: number;
  if (repeat >= 4) directorSignature = DIRECTOR_SIGNATURE.fourSame;
  else if (repeat === 3) directorSignature = DIRECTOR_SIGNATURE.threeSame;
  else if (repeat === 2 && directorCount >= 2)
    directorSignature = DIRECTOR_SIGNATURE.pairWithContrast;
  else if (overlapSignal)
    directorSignature = DIRECTOR_SIGNATURE.overlapWithoutRepeat;
  else directorSignature = DIRECTOR_SIGNATURE.random;

  const mainstreamMix = clamp(
    (100 * stdDev(footprintScores)) / FOOTPRINT_SPREAD_REFERENCE,
    0,
    100
  );

  const rareSignals = [
    hasUniqueValue(traits.map((t) => t.language)),
    hasUniqueValue(traits.flatMap((t) => t.regions)),
    hasUniqueValue(traits.map((t) => t.era)),
    // Genre sets: a genre carried by exactly one film is a rare trait.
    traits.map((t) => t.genreIds.join(",")).every((v) => v.length > 0) &&
      hasUniqueValue(traits.flatMap((t) => t.genreIds)),
  ].filter(Boolean).length;
  const rareFeature = rareSignals * RARE_FEATURE_PER_SIGNAL;

  const parts: { value: number | null; weight: number }[] = [
    { value: genreIdentity, weight: IDENTITY_WEIGHTS.genreConcentration },
    { value: directorSignature, weight: IDENTITY_WEIGHTS.directorSignature },
    { value: mainstreamMix, weight: IDENTITY_WEIGHTS.mainstreamMix },
    { value: rareFeature, weight: IDENTITY_WEIGHTS.rareFeature },
  ];
  const totalWeight = parts
    .filter((p) => p.value !== null)
    .reduce((acc, p) => acc + p.weight, 0);
  const score =
    totalWeight > 0
      ? parts.reduce(
          (acc, p) => acc + (p.value ?? 0) * (p.value !== null ? p.weight : 0),
          0
        ) / totalWeight
      : 0;

  return {
    score: clamp(score, 0, 100),
    sub: [
      {
        key: "genreConcentration",
        score: genreIdentity === null ? null : round(genreIdentity, 1),
      },
      {
        key: "directorSignature",
        score: round(directorSignature, 1),
        detail: { maxDirectorRepeat: repeat, overlapSignal: overlapSignal ? 1 : 0 },
      },
      {
        key: "mainstreamMix",
        score: round(mainstreamMix, 1),
        detail: { footprintSpread: round(stdDev(footprintScores), 1) },
      },
      {
        key: "rareFeature",
        score: round(rareFeature, 1),
        detail: { signals: rareSignals },
      },
    ],
  };
}

/* ── Build assembly ───────────────────────────────────────────── */

interface WeightedMetric {
  value: number | null;
  weight: number;
}

/** Weighted mean that drops null entries and renormalises the weights. */
function weightedMean(parts: WeightedMetric[]): number | null {
  const totalWeight = parts
    .filter((p) => p.value !== null)
    .reduce((acc, p) => acc + p.weight, 0);
  if (totalWeight === 0) return null;
  return (
    parts.reduce(
      (acc, p) => acc + (p.value ?? 0) * (p.value !== null ? p.weight : 0),
      0
    ) / totalWeight
  );
}

/**
 * Highest band whose floor the raw score reaches.
 *
 * Deliberately written as "last matching floor" rather than an exact
 * `min <= raw <= max` lookup: the bands are documented on integer boundaries
 * (45-54, 55-64, …), so an exact lookup has holes between them and sends any
 * fractional value in a hole — 54.7, say — to Level 1.
 */
function levelOf(raw: number): number {
  let level = 1;
  for (const band of LEVEL_BANDS) {
    if (raw >= band.min) level = band.level;
  }
  return level;
}

function confidenceLevelOf(score: number): BuildResult["build"]["confidenceLevel"] {
  if (score >= CONFIDENCE_BANDS.high) return "high";
  if (score >= CONFIDENCE_BANDS.medium) return "medium";
  if (score >= CONFIDENCE_BANDS.low) return "low";
  return "invalid";
}

/**
 * Score a Top 4 build from its four films.
 *
 * Dimensions: build quality (25%), variety (25%), coherence (20%),
 * identity (15%), recognition balance (15%), plus explicit rule adjustments.
 */
export function scoreBuild(
  films: NormalizedFilm[],
  filmScores: FilmScore[]
): Omit<BuildResult, "movies"> {
  const traits = films.map(traitsOf);
  const years = films
    .map((f) => f.year)
    .filter((y): y is number => y !== null);
  const footprintScores = filmScores
    .map((s) => s.dimensions.find((d) => d.key === "footprint")?.score ?? null)
    .filter((v): v is number => v !== null);

  /* Build quality — plain arithmetic mean of the four film scores. */
  const qualityScores = filmScores.map((s) => s.total);
  const quality = mean(qualityScores) ?? 0;

  /* Variety */
  const variety = computeVariety(traits, years);

  /* Coherence */
  const coherence = computeCoherence(traits);
  const genreAffinityMetric =
    coherence.sub.find((m) => m.key === "genreAffinity")?.score ?? 0;
  const keywordAffinityMetric =
    coherence.sub.find((m) => m.key === "keywordAffinity")?.score ?? null;

  /* Identity */
  const identity = computeIdentity(
    traits,
    genreAffinityMetric,
    keywordAffinityMetric,
    footprintScores
  );

  /* Recognition balance */
  const audienceScores = filmScores
    .map((s) => s.metrics["audience.imdbStrength"] ?? null)
    .filter((v): v is number => v !== null);
  const awardsScores = filmScores
    .map((s) => s.dimensions.find((d) => d.key === "awards")?.score ?? null)
    .filter((v): v is number => v !== null);
  const meanImdb = mean(audienceScores);
  const meanAwards = mean(awardsScores);
  const meanFootprint = mean(footprintScores);
  const recognitionSpread = stdDev(filmScores.map((s) => s.recognitionIndex));
  const spreadTerm = Math.min(
    100,
    RECOGNITION_SPREAD_MULTIPLIER * recognitionSpread
  );

  const recognition = weightedMean([
    { value: meanImdb, weight: RECOGNITION_WEIGHTS.imdb },
    { value: meanAwards, weight: RECOGNITION_WEIGHTS.awards },
    { value: meanFootprint, weight: RECOGNITION_WEIGHTS.footprint },
    { value: spreadTerm, weight: RECOGNITION_WEIGHTS.spread },
  ]);

  /* Historical depth — shared by the level system and the attribute panel. */
  const eraSub = variety.sub.find((m) => m.key === "era");
  const eraDiversity = eraSub?.score ?? 0;
  const awardsHistorySignal =
    meanAwards === null ? null : Math.min(100, meanAwards);
  const historicalDepth =
    weightedMean([
      { value: eraDiversity, weight: HISTORICAL_DEPTH_WEIGHTS.eraDiversity },
      {
        value: awardsHistorySignal,
        weight: HISTORICAL_DEPTH_WEIGHTS.awardsHistory,
      },
    ]) ?? 0;

  /* Dimensions */
  const recognitionScore = recognition ?? 0;
  const dimensions: BuildDimension[] = [
    {
      key: "quality",
      score: round(quality, 1),
      weight: BUILD_WEIGHTS.quality,
      contribution: round(quality * BUILD_WEIGHTS.quality, 2),
      sub: filmScores.map((s) => ({
        key: `film.${s.tmdbId}`,
        score: s.total,
      })),
    },
    {
      key: "variety",
      score: round(variety.score, 1),
      weight: BUILD_WEIGHTS.variety,
      contribution: round(variety.score * BUILD_WEIGHTS.variety, 2),
      sub: variety.sub,
    },
    {
      key: "coherence",
      score: round(coherence.score, 1),
      weight: BUILD_WEIGHTS.coherence,
      contribution: round(coherence.score * BUILD_WEIGHTS.coherence, 2),
      sub: coherence.sub,
    },
    {
      key: "identity",
      score: round(identity.score, 1),
      weight: BUILD_WEIGHTS.identity,
      contribution: round(identity.score * BUILD_WEIGHTS.identity, 2),
      sub: identity.sub,
    },
    {
      key: "recognition",
      score: round(recognitionScore, 1),
      weight: BUILD_WEIGHTS.recognition,
      contribution: round(recognitionScore * BUILD_WEIGHTS.recognition, 2),
      sub: [
        { key: "meanImdb", score: meanImdb === null ? null : round(meanImdb, 1) },
        {
          key: "meanAwards",
          score: meanAwards === null ? null : round(meanAwards, 1),
        },
        {
          key: "meanFootprint",
          score:
            meanFootprint === null ? null : round(meanFootprint, 1),
        },
        { key: "spread", score: round(spreadTerm, 1) },
      ],
    },
  ];

  /* Rule adjustments */
  const adjustments: RuleAdjustment[] = [];
  const distinctEras = distinctCount(traits.map((t) => t.era));
  const distinctLanguages = distinctCount(traits.map((t) => t.language));
  const distinctRegions = distinctCount(traits.flatMap((t) => t.regions));
  const primaryRegions = distinctCount(
    traits.map((t) => t.regions[0] ?? null)
  );
  const distinctGenres = distinctCount(traits.flatMap((t) => t.genreIds));

  if (
    distinctEras >= RULE_TRIPLE_COVERAGE.eras &&
    (distinctLanguages >= RULE_TRIPLE_COVERAGE.languagesOrRegions ||
      distinctRegions >= RULE_TRIPLE_COVERAGE.languagesOrRegions) &&
    distinctGenres >= RULE_TRIPLE_COVERAGE.genres
  ) {
    adjustments.push({ key: "tripleCoverage", delta: RULE_DELTAS.tripleCoverage });
  }
  if (
    filmScores.filter((s) => s.total >= RULE_DISTRIBUTED_RECOGNITION.minScore)
      .length >= RULE_DISTRIBUTED_RECOGNITION.films
  ) {
    adjustments.push({
      key: "distributedRecognition",
      delta: RULE_DELTAS.distributedRecognition,
    });
  }
  if (
    collectionPenalty(traits.map((t) => t.collectionId)) ===
    COLLECTION_PENALTY_ALL_SAME
  ) {
    adjustments.push({ key: "sameCollection", delta: RULE_DELTAS.sameCollection });
  }
  if (
    distinctEras === 1 &&
    distinctLanguages === 1 &&
    primaryRegions === 1
  ) {
    adjustments.push({ key: "homogeneousEra", delta: RULE_DELTAS.homogeneousEra });
  }
  if (
    distinctGenres <= RULE_NARROW_GENRE_MAX_TYPES &&
    distinctLanguages === 1
  ) {
    adjustments.push({ key: "narrowGenre", delta: RULE_DELTAS.narrowGenre });
  }

  const isCheat = films.length > 4;
  const rawAdjustment = adjustments.reduce((acc, a) => acc + a.delta, 0);
  const adjustment = isCheat
    ? RULE_DELTAS.cheat
    : clamp(rawAdjustment, -10, 5);
  if (isCheat) adjustments.push({ key: "cheat", delta: RULE_DELTAS.cheat });

  const total = clamp(
    dimensions.reduce((acc, d) => acc + d.contribution, 0) + adjustment,
    0,
    100
  );

  /* Attributes — derived only from values computed above. */
  const attributes: Record<string, number | null> = {
    filmCriticism: (() => {
      const value = weightedMean([
        { value: meanImdb, weight: FILM_CRITICISM_WEIGHTS.imdb },
        { value: meanAwards, weight: FILM_CRITICISM_WEIGHTS.awards },
        {
          value: historicalDepth,
          weight: FILM_CRITICISM_WEIGHTS.historicalDepth,
        },
      ]);
      return value === null ? null : round(value, 1);
    })(),
    originality: round(identity.score, 1),
    mainstreamPower: meanFootprint === null ? null : round(meanFootprint, 1),
    buildCoherence: round(coherence.score, 1),
    historicalDepth: round(historicalDepth, 1),
    awardsPrestige: meanAwards === null ? null : round(meanAwards, 1),
    publicConsensus: meanImdb === null ? null : round(meanImdb, 1),
    roastVulnerability: round(
      clamp(
        100 -
          ROAST_VULNERABILITY_WEIGHTS.variety * variety.score -
          ROAST_VULNERABILITY_WEIGHTS.coherence * coherence.score -
          ROAST_VULNERABILITY_WEIGHTS.identity * identity.score,
        0,
        100
      ),
      1
    ),
  };

  /* Level */
  const levelRaw =
    LEVEL_WEIGHTS.variety * variety.score +
    LEVEL_WEIGHTS.coherence * coherence.score +
    LEVEL_WEIGHTS.identity * identity.score +
    LEVEL_WEIGHTS.historicalDepth * historicalDepth;

  const confidence =
    mean(filmScores.map((s) => s.confidence)) ?? 0;

  const diagnostics: BuildDiagnostics = {
    eraBuckets: distinctEras,
    languages: distinctLanguages,
    regions: distinctRegions,
    genres: distinctGenres,
    directors: distinctCount(traits.map((t) => t.director)),
    yearSpan:
      years.length > 1 ? Math.max(...years) - Math.min(...years) : 0,
    languageList: [
      ...new Set(traits.map((t) => t.language).filter((v): v is string => !!v)),
    ],
    regionList: [...new Set(traits.flatMap((t) => t.regions))],
    genreList: [...new Set(traits.flatMap((t) => t.genreIds))].map(String),
    directorList: [
      ...new Set(
        traits.map((t) => t.director).filter((v): v is string => !!v)
      ),
    ],
    eraList: [...new Set(traits.map((t) => t.era))],
  };

  /* Schools — pattern-naming over the signals above; never scored. */
  const genreConcentrationScore =
    identity.sub.find((m) => m.key === "genreConcentration")?.score ?? null;
  const directorSignatureScore =
    identity.sub.find((m) => m.key === "directorSignature")?.score ?? 0;
  const mainstreamMixScore =
    identity.sub.find((m) => m.key === "mainstreamMix")?.score ?? 0;
  const comfortGenreIds = new Set([35, 10749, 10751, 16, 10402]);
  const comfortFilms = traits.filter((t) =>
    t.genreIds.some((g) => comfortGenreIds.has(g))
  ).length;
  const oscarFilms = films.filter(
    (f) =>
      f.awards &&
      (f.awards.oscar_best_picture ||
        f.awards.oscar_best_director ||
        f.awards.oscar_other_awards_count > 0)
  ).length;
  const schools = detectSchools({
    eraList: traits.map((t) => t.era),
    nonEnglishFilms: traits.filter((t) => t.language && t.language !== "en")
      .length,
    distinctLanguages,
    comfortFilms,
    maxDirectorRepeat: maxDirectorRepeat(traits),
    directorSignature: directorSignatureScore,
    genreConcentration: genreConcentrationScore,
    variety: variety.score,
    coherence: coherence.score,
    identity: identity.score,
    mainstreamMix: mainstreamMixScore,
    filmCriticism: attributes.filmCriticism,
    publicConsensus: attributes.publicConsensus,
    awardsPrestige: attributes.awardsPrestige,
    historicalDepth,
    recognitionSpreadTerm: spreadTerm,
    sameCollection: adjustments.some((a) => a.key === "sameCollection"),
    oscarFilms,
    filmVotePts: filmScores.map((s) => ({
      imdb: s.metrics["footprint.imdbVotes"] ?? null,
      tmdb: s.metrics["footprint.tmdbVotes"] ?? null,
    })),
  });

  const tier: Tier = tierFrom(total, BUILD_TIER_THRESHOLDS);

  return {
    films: filmScores,
    build: {
      total: round(total, 1),
      tier,
      level: levelOf(levelRaw),
      levelRaw: round(levelRaw, 1),
      dimensions,
      adjustments,
      attributes,
      schools,
      confidence: round(confidence, 0),
      confidenceLevel: confidenceLevelOf(confidence),
    },
    diagnostics,
  };
}
