/**
 * Tunable parameters for the movie-taste scoring algorithm.
 * Every threshold and weight lives here so the whole model can be re-tuned
 * from a single file.
 */

/* ── Film score: dimension weights (sum = 1) ─────────────────── */
export const WEIGHT_AUDIENCE = 0.2;
export const WEIGHT_LEGACY = 0.35;
export const WEIGHT_AWARDS = 0.2;
export const WEIGHT_FOOTPRINT = 0.25;

/* ── IMDb Bayesian shrinkage ─────────────────────────────────── */
export const IMDB_BAYESIAN_M = 25_000;
export const IMDB_BAYESIAN_C = 6.8;
/** Rating window mapped onto 0-100 (`clamp(100 × (WR − 5.0) / 4.0)`). */
export const IMDB_SCORE_FLOOR = 5.0;
export const IMDB_SCORE_RANGE = 4.0;
/** Vote counts used as the log-scale reference points. */
export const IMDB_VOTE_REFERENCE = 1_000_000;
export const TMDB_VOTE_REFERENCE = 15_000;
export const REVENUE_REFERENCE = 1_000_000_000;
export const POPULARITY_REFERENCE = 100;

/** IMDB Strength = 0.85 × Bayesian score + 0.15 × vote credibility. */
export const IMDB_STRENGTH_BAYES_WEIGHT = 0.85;
export const IMDB_STRENGTH_CREDIBILITY_WEIGHT = 0.15;
/** Audience = 0.70 × IMDB Strength + 0.30 × TMDB score. */
export const AUDIENCE_IMDB_WEIGHT = 0.7;
export const AUDIENCE_TMDB_WEIGHT = 0.3;

/* ── Cultural footprint sub-item maxima (sum = 100) ──────────── */
export const FOOTPRINT_IMDB_VOTES_MAX = 40;
export const FOOTPRINT_TMDB_VOTES_MAX = 30;
export const FOOTPRINT_REVENUE_MAX = 15;
export const FOOTPRINT_POPULARITY_MAX = 15;

/* ── Historical standing (影史地位) ──────────────────────────── */
export const LEGACY_POINTS = {
  tspdtTop1000: 13,
  tspdt21stCentury: 6,
  sightAndSoundCritics: 4,
  cahiersTop10: 5,
} as const;

/** Full denominator for a film that can appear on every list (13 + 6 + 4 + 5).
 *  A list a film is structurally ineligible for leaves the denominator
 *  entirely — see TSPDT_21ST_CENTURY_FIRST_YEAR — so it never charges a
 *  penalty for something the film was never able to earn. */
export const LEGACY_MAX_POINTS = 28;

/** The TSPDT 21st Century list only covers films released from this year on.
 *  For a film *verified* to be older that is absent from the list, the
 *  sub-item is UNKNOWN rather than NONE: its 6 points leave the denominator
 *  (28 → 22) instead of scoring 0. A film with an unknown release year is not
 *  exempted — ineligibility has to be established, not assumed. */
export const TSPDT_21ST_CENTURY_FIRST_YEAR = 2000;

/** Ranked-list lengths, used to map rank → points linearly. */
export const LIST_LENGTH = {
  tspdtTop1000: 1000,
  tspdt21stCentury: 1000,
  /** Sight & Sound 2022 critics poll — the dataset's extended list. */
  sightAndSound: 250,
  cahiersTop10: 10,
} as const;

/**
 * Share of a list's points that its last-ranked film still keeps.
 *
 * A pure linear decay reaches zero at the end of the list, which on a
 * thousand-long list means everything past the first few hundred ranks scores
 * almost nothing: measured over a 200-film random sample, 44% of the dataset
 * sat at 0 on this dimension while it carries the largest weight in the film
 * score. That flattened the middle of the distribution and left the total
 * ranking driven by audience rating and cultural footprint — i.e. by fame
 * rather than by standing in film history, which is the opposite of what the
 * dimension is for.
 *
 * Holding a floor keeps "listed high" and "listed low" distinct — rank 1
 * still earns about 2.9x what rank 1000 does on the same list — while letting
 * the tail contribute. Only placement inside a list is affected; a film on
 * none of the four lists still scores 0.
 */
export const RANK_DECAY_FLOOR = 0.35;

/* ── Awards ──────────────────────────────────────────────────── */
export const OSCAR_BEST_PICTURE_POINTS = 8;
export const OSCAR_BEST_DIRECTOR_POINTS = 5;
export const OSCAR_OTHER_POINTS_PER_AWARD = 0.5;
export const OSCAR_OTHER_POINTS_CAP = 2;
export const OSCAR_MAX_POINTS = 15;

export const FESTIVAL_POINTS = {
  palmeDOr: 10,
  goldenLion: 9,
  goldenBear: 8,
  cannesGrandPrix: 6,
  cannesBestDirector: 5,
  cannesJuryPrize: 4,
  veniceGrandJuryPrize: 5,
  berlinaleGrandJuryPrize: 5,
  berlinaleJuryPrize: 3,
} as const;
export const FESTIVAL_MAX_POINTS = 10;

/** Awards = 0.50 × Oscar + 0.35 × festival + 0.15 × breadth. */
export const AWARDS_OSCAR_WEIGHT = 0.5;
export const AWARDS_FESTIVAL_WEIGHT = 0.35;
export const AWARDS_BREADTH_WEIGHT = 0.15;
/** Breadth awards coverage across institutions rather than volume. */
export const AWARD_BREADTH_PER_INSTITUTION = 25;

/* ── Tier thresholds ─────────────────────────────────────────── */
/**
 * The two scores live on different scales and get their own band edges.
 *
 * A film score starts from four measured dimensions and is widely spread
 * (16-86 across a 262-film sample). A build score is a weighted mean of five
 * already-averaged dimensions, so it is inherently compressed (37-77) — using
 * one shared threshold table left the upper bands unreachable.
 * Both tables were fitted to the measured distributions over that sample.
 */

/** Film score bands. Measured share over a 200-film random sample of the list
 *  dataset: 60 → 3.5%, 50 → 9.5%, 40 → 25%, 28 → 60.5%. The gaps are kept
 *  even (10/10/12) so that each band reads as a step rather than a jump.
 *
 *  The S line sat at 70 when this table was first fitted, and was effectively
 *  unreachable: only 1% of the dataset cleared it, and 68/66/64 cleared no
 *  more films than 70 did, because the distribution is empty between 64 and
 *  72. Lowering the line is not the same as widening the pool — a user naming
 *  films they actually know (IMDb ≥ 200k votes) already produced 6% S before
 *  the line moved. */
export const FILM_TIER_THRESHOLDS = { S: 60, A: 50, B: 40, C: 28 } as const;

/** Build score bands. Measured over 20k random quartets drawn from a 404-film
 *  pool of TMDB popular + top-rated films (the stand-in for "films a user
 *  would name"): 67 → 0.2%, 58 → 26%, 53 → 68%, 46 → 98%.
 *
 *  The same quartets restricted to the pool's top decile — a deliberate pick
 *  from the canon — clear 67 41% of the time. They cleared the previous 63
 *  line 78% of the time, which stamped almost any famous quartet S and left
 *  the badge saying nothing about the pick; the line now separates a
 *  considered quartet from an arbitrary one.
 *
 *  The S line sat at 66 when this table was first fitted. That pool topped out
 *  at 65.6, so S was in fact unreachable — the earlier 0.4% reading came from
 *  a thinner sample of a differently-built pool. It moved to 63 and then to
 *  67; the S→A step is wider than the two below it on purpose, because S is
 *  meant to be a step above a solid canonical quartet rather than a synonym
 *  for one. C stays high enough that F is reserved for genuinely weak material
 *  or rule violations, not for an ordinary mainstream pick. */
export const BUILD_TIER_THRESHOLDS = { S: 67, A: 58, B: 53, C: 46 } as const;

/* ── Build score: dimension weights (sum = 1) ────────────────── */
export const BUILD_WEIGHTS = {
  quality: 0.25,
  variety: 0.25,
  coherence: 0.2,
  identity: 0.15,
  recognition: 0.15,
} as const;

/* ── Variety ─────────────────────────────────────────────────── */
export const VARIETY_WEIGHTS = {
  era: 0.25,
  languageRegion: 0.25,
  genre: 0.25,
  director: 0.15,
  collection: 0.1,
} as const;
/** Era entropy (70%) + continuous year span (30%). */
export const ERA_ENTROPY_WEIGHT = 0.7;
export const ERA_SPAN_WEIGHT = 0.3;
export const ERA_FULL_SPAN = 80;
/** Language-region split. */
export const LANGUAGE_REGION_LANGUAGE_WEIGHT = 0.55;
export const LANGUAGE_REGION_REGION_WEIGHT = 0.45;
/** Max regions a co-production may contribute, to avoid inflation. */
export const MAX_REGIONS_PER_FILM = 2;
/** Company repeat-rate penalty scale. */
export const COMPANY_OVERLAP_PENALTY = 25;
/** Collection penalties. */
export const COLLECTION_PENALTY_ALL_SAME = 50;
export const COLLECTION_PENALTY_THREE_SAME = 25;

/* ── Coherence ───────────────────────────────────────────────── */
export const COHERENCE_WEIGHTS = {
  genreAffinity: 0.4,
  keywordAffinity: 0.25,
  creatorAffinity: 0.2,
  eraAffinity: 0.15,
} as const;
export const CREATOR_DIRECTOR_WEIGHT = 0.7;
export const CREATOR_COMPANY_WEIGHT = 0.3;

/**
 * Coherence is single-peaked rather than monotone: the dimension measures
 * "span with a nameable thread", so both failure modes lose points.
 *
 * A build whose films share nothing is a random draw; a build whose films are
 * interchangeable is a repetition, not a statement. Only the band in between
 * — a recognisable sensibility with genuine range — tops out.
 *
 * `COHERENCE_PEAK` sits just above the median blended affinity of a random
 * quartet drawn from a realistic pool (measured p50 ≈ 16, p90 ≈ 23 over 20k
 * samples), so an ordinary unconsidered pick scores decently but a deliberate
 * one can clearly beat it.
 */
export const COHERENCE_PEAK = 35;
/** Score at affinity 0 — four films with nothing in common at all. */
export const COHERENCE_FLOOR_DISPARATE = 40;
/** Score at affinity 100 — four films that are effectively the same film. */
export const COHERENCE_FLOOR_CLUSTERED = 45;

/* ── Identity ────────────────────────────────────────────────── */
export const IDENTITY_WEIGHTS = {
  genreConcentration: 0.35,
  directorSignature: 0.3,
  mainstreamMix: 0.2,
  rareFeature: 0.15,
} as const;
export const GENRE_IDENTITY_CAP = 80;
/** Herfindahl baseline: 0.25 = perfectly even spread over 4 films. */
export const GENRE_CONCENTRATION_BASELINE = 0.25;
export const FOOTPRINT_SPREAD_REFERENCE = 40;
export const RARE_FEATURE_PER_SIGNAL = 25;

/** Director-signature score table. */
export const DIRECTOR_SIGNATURE = {
  pairWithContrast: 80,
  threeSame: 70,
  fourSame: 60,
  overlapWithoutRepeat: 30,
  random: 20,
} as const;
/** Genre/keyword affinity above which a non-repeating build still reads
 *  as "deliberately clustered" rather than random. */
export const DIRECTOR_OVERLAP_THRESHOLD = 50;

/* ── Recognition balance ─────────────────────────────────────── */
export const RECOGNITION_WEIGHTS = {
  imdb: 0.45,
  awards: 0.3,
  footprint: 0.15,
  spread: 0.1,
} as const;
export const RECOGNITION_SPREAD_MULTIPLIER = 2;

/* ── Rule adjustments ────────────────────────────────────────── */
export const RULE_DELTAS = {
  tripleCoverage: 3,
  distributedRecognition: 2,
  sameCollection: -3,
  homogeneousEra: -2,
  narrowGenre: -2,
  cheat: -100,
} as const;
/** Thresholds backing the rule checks. */
export const RULE_TRIPLE_COVERAGE = { eras: 3, languagesOrRegions: 3, genres: 4 };
export const RULE_DISTRIBUTED_RECOGNITION = { films: 3, minScore: 60 };
export const RULE_NARROW_GENRE_MAX_TYPES = 2;
export const ADJUSTMENT_FLOOR = -10;
export const ADJUSTMENT_CEIL = 5;

/* ── Level system ────────────────────────────────────────────── */
export const LEVEL_WEIGHTS = {
  variety: 0.35,
  coherence: 0.3,
  identity: 0.2,
  historicalDepth: 0.15,
} as const;
export const HISTORICAL_DEPTH_WEIGHTS = {
  eraDiversity: 0.6,
  awardsHistory: 0.4,
} as const;

/** Level floors. Read as "at least this much → this level"; `max` is
 *  documentation only, so a fractional score between two documented bands
 *  still resolves instead of falling through to Level 1.
 *
 *  The bands are 4 points wide by necessity: `levelRaw` is a weighted mean of
 *  four already-normalised dimensions, and over 20k random quartets it spans
 *  only about 43-77 (p10 = 55, p50 = 61, p90 = 66, max = 77). Wider bands
 *  would put every build in the same two levels. Level 5 is anchored on the
 *  measured median. */
export const LEVEL_BANDS: { level: number; min: number; max: number }[] = [
  { level: 1, min: 0, max: 46 },
  { level: 2, min: 47, max: 50 },
  { level: 3, min: 51, max: 54 },
  { level: 4, min: 55, max: 58 },
  { level: 5, min: 59, max: 62 },
  { level: 6, min: 63, max: 66 },
  { level: 7, min: 67, max: 70 },
  { level: 8, min: 71, max: 74 },
  { level: 9, min: 75, max: 100 },
];

/* ── Attribute panel ─────────────────────────────────────────── */
export const FILM_CRITICISM_WEIGHTS = {
  imdb: 0.45,
  awards: 0.35,
  historicalDepth: 0.2,
} as const;
export const ROAST_VULNERABILITY_WEIGHTS = {
  variety: 0.45,
  coherence: 0.35,
  identity: 0.2,
} as const;

/* ── Data confidence ─────────────────────────────────────────── */
export const CONFIDENCE_POINTS = {
  hasImdbId: 25,
  hasImdbRatingAndVotes: 25,
  hasTmdbGenresAndYear: 20,
  hasDirector: 15,
  awardsVerified: 15,
} as const;
export const CONFIDENCE_BANDS = {
  high: 85,
  medium: 65,
  low: 40,
} as const;

/* ── Era buckets (7 fixed buckets) ───────────────────────────── */
export const ERA_BUCKETS = [
  { id: "pre1930s", min: -Infinity, max: 1929 },
  { id: "1930s50s", min: 1930, max: 1959 },
  { id: "1960s70s", min: 1960, max: 1979 },
  { id: "1980s90s", min: 1980, max: 1999 },
  { id: "2000s", min: 2000, max: 2009 },
  { id: "2010s", min: 2010, max: 2019 },
  { id: "2020s", min: 2020, max: Infinity },
] as const;

/**
 * Country code → macro-region. Complete coverage of ISO 3166-1 alpha-2 plus
 * the historical codes TMDB still emits for pre-1990s productions (Soviet
 * Union, Yugoslavia, Czechoslovakia, East Germany…). Only uninhabited
 * territories (Antarctica, the oceanic outliers) are left unmapped so they
 * fall through to `OTHER_REGION`. Co-productions contribute at most
 * `MAX_REGIONS_PER_FILM` regions so that long production-country lists do not
 * inflate regional diversity.
 */
export const REGION_MAP: Record<string, string> = {
  // US & Canada (+ Greenland, St Pierre & Miquelon)
  US: "US_CANADA",
  CA: "US_CANADA",
  GL: "US_CANADA",
  PM: "US_CANADA",

  // Europe (incl. Russia, the Caucasus, Cyprus, and the historical states
  // whose cinema culture sits here: USSR, Yugoslavia, Czechoslovakia,
  // Serbia & Montenegro, East Germany, metropolitan France)
  SU: "EUROPE",
  GB: "EUROPE", IE: "EUROPE", FR: "EUROPE", FX: "EUROPE", DE: "EUROPE",
  DD: "EUROPE", NL: "EUROPE", BE: "EUROPE", LU: "EUROPE", CH: "EUROPE",
  AT: "EUROPE", IT: "EUROPE", SM: "EUROPE", VA: "EUROPE", MT: "EUROPE",
  LI: "EUROPE", MC: "EUROPE", GG: "EUROPE", IM: "EUROPE", JE: "EUROPE",
  ES: "EUROPE", PT: "EUROPE", AD: "EUROPE", GI: "EUROPE",
  DK: "EUROPE", NO: "EUROPE", SE: "EUROPE", FI: "EUROPE", IS: "EUROPE",
  FO: "EUROPE", SJ: "EUROPE", AX: "EUROPE", EE: "EUROPE", LV: "EUROPE",
  LT: "EUROPE", PL: "EUROPE", CZ: "EUROPE", XC: "EUROPE", SK: "EUROPE",
  HU: "EUROPE", RO: "EUROPE", BG: "EUROPE", GR: "EUROPE", CY: "EUROPE",
  AL: "EUROPE", MK: "EUROPE", RS: "EUROPE", CS: "EUROPE", ME: "EUROPE",
  BA: "EUROPE", HR: "EUROPE", SI: "EUROPE", YU: "EUROPE", XK: "EUROPE",
  RU: "EUROPE", UA: "EUROPE", BY: "EUROPE", MD: "EUROPE",
  AM: "EUROPE", AZ: "EUROPE", GE: "EUROPE",

  // East & Inner Asia
  JP: "EAST_ASIA", KR: "EAST_ASIA", KP: "EAST_ASIA", CN: "EAST_ASIA",
  HK: "EAST_ASIA", TW: "EAST_ASIA", MO: "EAST_ASIA", MN: "EAST_ASIA",
  KZ: "EAST_ASIA", UZ: "EAST_ASIA", TM: "EAST_ASIA", KG: "EAST_ASIA",
  TJ: "EAST_ASIA",

  // South Asia
  IN: "SOUTH_ASIA", PK: "SOUTH_ASIA", BD: "SOUTH_ASIA", LK: "SOUTH_ASIA",
  NP: "SOUTH_ASIA", BT: "SOUTH_ASIA", AF: "SOUTH_ASIA", MV: "SOUTH_ASIA",

  // Southeast Asia
  TH: "SOUTHEAST_ASIA", VN: "SOUTHEAST_ASIA", VD: "SOUTHEAST_ASIA",
  PH: "SOUTHEAST_ASIA", ID: "SOUTHEAST_ASIA", MY: "SOUTHEAST_ASIA",
  SG: "SOUTHEAST_ASIA", BN: "SOUTHEAST_ASIA", KH: "SOUTHEAST_ASIA",
  LA: "SOUTHEAST_ASIA", MM: "SOUTHEAST_ASIA", TL: "SOUTHEAST_ASIA",

  // Middle East & North Africa
  TR: "MIDDLE_EAST", IR: "MIDDLE_EAST", IL: "MIDDLE_EAST", PS: "MIDDLE_EAST",
  SA: "MIDDLE_EAST", AE: "MIDDLE_EAST", QA: "MIDDLE_EAST", KW: "MIDDLE_EAST",
  BH: "MIDDLE_EAST", OM: "MIDDLE_EAST", YE: "MIDDLE_EAST", YD: "MIDDLE_EAST",
  IQ: "MIDDLE_EAST", SY: "MIDDLE_EAST", JO: "MIDDLE_EAST", LB: "MIDDLE_EAST",
  EG: "MIDDLE_EAST", LY: "MIDDLE_EAST", SD: "MIDDLE_EAST", SS: "MIDDLE_EAST",
  MA: "MIDDLE_EAST", DZ: "MIDDLE_EAST", TN: "MIDDLE_EAST", EH: "MIDDLE_EAST",

  // Sub-Saharan Africa (incl. Zaire and Mayotte/Réunion)
  AO: "AFRICA", MR: "AFRICA", ML: "AFRICA", NE: "AFRICA", TD: "AFRICA",
  SN: "AFRICA", GM: "AFRICA", GN: "AFRICA", GW: "AFRICA",
  SL: "AFRICA", LR: "AFRICA", CI: "AFRICA", GH: "AFRICA",
  TG: "AFRICA", BJ: "AFRICA", BF: "AFRICA", NG: "AFRICA",
  CM: "AFRICA", CF: "AFRICA", GQ: "AFRICA", GA: "AFRICA",
  CG: "AFRICA", CD: "AFRICA", ZR: "AFRICA", ST: "AFRICA",
  ET: "AFRICA", ER: "AFRICA", DJ: "AFRICA", SO: "AFRICA",
  KE: "AFRICA", UG: "AFRICA", RW: "AFRICA", BI: "AFRICA",
  TZ: "AFRICA", MZ: "AFRICA", MW: "AFRICA", ZM: "AFRICA",
  ZW: "AFRICA", BW: "AFRICA", NA: "AFRICA", SZ: "AFRICA",
  LS: "AFRICA", ZA: "AFRICA", MG: "AFRICA", MU: "AFRICA",
  KM: "AFRICA", SC: "AFRICA", CV: "AFRICA", SH: "AFRICA",
  RE: "AFRICA", YT: "AFRICA",

  // Latin America & the Caribbean (incl. Suriname/Guyana and the Dutch
  // Antilles, historical code included)
  MX: "LATIN_AMERICA", GT: "LATIN_AMERICA", BZ: "LATIN_AMERICA",
  SV: "LATIN_AMERICA", HN: "LATIN_AMERICA", NI: "LATIN_AMERICA",
  CR: "LATIN_AMERICA", PA: "LATIN_AMERICA", CU: "LATIN_AMERICA",
  JM: "LATIN_AMERICA", HT: "LATIN_AMERICA", DO: "LATIN_AMERICA",
  PR: "LATIN_AMERICA", TT: "LATIN_AMERICA", BB: "LATIN_AMERICA",
  BS: "LATIN_AMERICA", AG: "LATIN_AMERICA", DM: "LATIN_AMERICA",
  GD: "LATIN_AMERICA", KN: "LATIN_AMERICA", LC: "LATIN_AMERICA",
  VC: "LATIN_AMERICA", AI: "LATIN_AMERICA", AW: "LATIN_AMERICA",
  BL: "LATIN_AMERICA", BQ: "LATIN_AMERICA", CW: "LATIN_AMERICA",
  GP: "LATIN_AMERICA", KY: "LATIN_AMERICA", MF: "LATIN_AMERICA",
  MQ: "LATIN_AMERICA", MS: "LATIN_AMERICA", SX: "LATIN_AMERICA",
  TC: "LATIN_AMERICA", VG: "LATIN_AMERICA", VI: "LATIN_AMERICA",
  AN: "LATIN_AMERICA", BM: "LATIN_AMERICA", FK: "LATIN_AMERICA",
  CO: "LATIN_AMERICA", VE: "LATIN_AMERICA", GY: "LATIN_AMERICA",
  SR: "LATIN_AMERICA", EC: "LATIN_AMERICA", PE: "LATIN_AMERICA",
  BR: "LATIN_AMERICA", BO: "LATIN_AMERICA", PY: "LATIN_AMERICA",
  UY: "LATIN_AMERICA", AR: "LATIN_AMERICA", CL: "LATIN_AMERICA",
  GF: "LATIN_AMERICA",

  // Oceania (incl. the Pacific islands and Australia's oceanic territories)
  AU: "OCEANIA", NZ: "OCEANIA", NF: "OCEANIA", CK: "OCEANIA",
  NU: "OCEANIA", TK: "OCEANIA", PF: "OCEANIA", NC: "OCEANIA",
  WF: "OCEANIA", FJ: "OCEANIA", PG: "OCEANIA", SB: "OCEANIA",
  VU: "OCEANIA", WS: "OCEANIA", TO: "OCEANIA", TV: "OCEANIA",
  NR: "OCEANIA", KI: "OCEANIA", PW: "OCEANIA", FM: "OCEANIA",
  MH: "OCEANIA", MP: "OCEANIA", GU: "OCEANIA", AS: "OCEANIA",
  CC: "OCEANIA", CX: "OCEANIA", PN: "OCEANIA",

  // Deliberately unmapped (uninhabited): AQ Antarctica, BV Bouvet,
  // GS South Georgia, HM Heard & McDonald, IO British Indian Ocean,
  // TF French Southern Territories, UM US minor outlying islands.
};

export const OTHER_REGION = "OTHER";
