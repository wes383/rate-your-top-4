/**
 * Shared domain types.
 *
 * `NormalizedFilm` is the single shape the scoring engine consumes, no matter
 * whether the raw data came from TMDB + IMDb at runtime or from the bundled
 * demo dataset.
 */

/** Award / ranking record from `data/movies.json`, keyed by TMDB id. */
export interface AwardRecord {
  title: string;
  tmdb_id: number;
  oscar_best_picture: number;
  oscar_best_director: number;
  oscar_other_awards_count: number;
  palme_d_or: number;
  golden_lion: number;
  golden_bear: number;
  cannes_grand_prix: number;
  cannes_jury_prize: number;
  cannes_best_director: number;
  venice_grand_jury_prize: number;
  berlinale_grand_jury_prize: number;
  berlinale_jury_prize: number;
  tspdt_top_1000_rank: number | null;
  tspdt_21st_century_rank: number | null;
  sight_and_sound_2022_rank: number | null;
  cahiers_top_10_rank: number | string | null;
}

export interface Genre {
  id: number;
  name: string;
}

export interface Keyword {
  id: number;
  name: string;
}

export interface Company {
  id: number;
  name: string;
}

export interface Collection {
  id: number;
  name: string;
}

/** A movie with every field the scoring engine can use, already normalized. */
export interface NormalizedFilm {
  tmdbId: number;
  imdbId: string | null;
  /** Original-language title. */
  originalTitle: string | null;
  title: string;
  titleZh: string | null;
  overview: string | null;
  overviewZh: string | null;
  releaseDate: string | null;
  year: number | null;
  runtime: number | null;
  posterPath: string | null;
  genres: Genre[];
  keywords: Keyword[];
  director: string | null;
  directorId: number | null;
  companies: Company[];
  /** ISO 3166-1 alpha-2 codes. */
  countries: string[];
  originalLanguage: string | null;
  collection: Collection | null;
  revenue: number | null;
  popularity: number | null;
  tmdbRating: number | null;
  tmdbVotes: number | null;
  imdbRating: number | null;
  imdbVotes: number | null;
  /** `null` means the film is absent from the local award dataset, which the
   *  scorer reads as "on none of these lists, no major awards" (a verified
   *  NONE) rather than as an unknown quantity. */
  awards: AwardRecord | null;
  /** Provenance, used by the UI to flag demo data. */
  source: "tmdb" | "demo";
}

/** Lightweight record used by the search list and the slot cards. */
export interface MovieBrief {
  tmdbId: number;
  title: string;
  titleZh: string | null;
  originalTitle: string | null;
  year: number | null;
  posterPath: string | null;
  tmdbRating: number | null;
  overview: string | null;
  overviewZh: string | null;
  /** Whether the local award dataset has an entry for this film. */
  inAwardDataset: boolean;
  source: "tmdb" | "demo";
}

/* ── Scoring output ───────────────────────────────────────────── */

export type Tier = "S" | "A" | "B" | "C" | "F";

export type DimensionKey = "audience" | "legacy" | "awards" | "footprint";

export type SubScoreKey =
  | "era"
  | "languageRegion"
  | "genre"
  | "director"
  | "collection"
  | "affinity"
  | "genreAffinity"
  | "keywordAffinity"
  | "creatorAffinity"
  | "eraAffinity"
  | "genreConcentration"
  | "directorSignature"
  | "mainstreamMix"
  | "rareFeature";

/** A 0-100 sub-metric that may be unavailable (UNKNOWN ≠ 0). */
export interface Metric {
  key: SubScoreKey | DimensionKey | string;
  score: number | null;
  /** Raw values backing the metric, for the transparency panel. */
  detail?: Record<string, number | string | null>;
}

export interface FilmDimension {
  key: DimensionKey;
  /** 0-100, or null when the whole dimension is UNKNOWN. */
  score: number | null;
  /** Nominal weight from the algorithm document. */
  weight: number;
  /** Weight after redistributing UNKNOWN dimensions. */
  effectiveWeight: number;
  /** score × effectiveWeight, i.e. the points this dimension adds. */
  contribution: number;
  detail: Record<string, number | string | null>;
}

export interface FilmScore {
  tmdbId: number;
  total: number;
  tier: Tier;
  dimensions: FilmDimension[];
  recognitionIndex: number;
  confidence: number;
  missing: string[];
  /** Intermediate values keyed by a stable identifier, for the detail view. */
  metrics: Record<string, number | null>;
}

export interface BuildDimension {
  key: string;
  score: number;
  weight: number;
  contribution: number;
  sub: Metric[];
  detail?: Record<string, number | string | null>;
}

export interface RuleAdjustment {
  key: string;
  delta: number;
}

/**
 * Named build archetypes the engine can detect from the same signals the five
 * dimensions already use. Detection is pattern-naming only — schools never
 * feed back into the total. Motivation-based archetypes (nostalgia, irony)
 * are deliberately absent: the data cannot see intent.
 */
export type SchoolKey =
  | "franchise"
  | "auteurSpecialist"
  | "genreSpecialist"
  | "oldSchool"
  | "youngCinephile"
  | "internationalHunter"
  | "chaosDraw"
  | "ultimateMixer"
  | "hotColdMixer"
  | "awardsSeason"
  | "cinephileStandard"
  | "artHouse"
  | "cinephile"
  | "crowdPleaser"
  | "comfortViewer"
  | "niche";

export interface BuildDiagnostics {
  eraBuckets: number;
  languages: number;
  regions: number;
  genres: number;
  directors: number;
  yearSpan: number;
  languageList: string[];
  regionList: string[];
  genreList: string[];
  directorList: string[];
  eraList: string[];
}

export interface BuildResult {
  films: FilmScore[];
  build: {
    total: number;
    tier: Tier;
    level: number;
    levelRaw: number;
    dimensions: BuildDimension[];
    adjustments: RuleAdjustment[];
    attributes: Record<string, number | null>;
    /** Matching archetypes, most specific first; empty when none applies. */
    schools: SchoolKey[];
    confidence: number;
    confidenceLevel: "high" | "medium" | "low" | "invalid";
  };
  diagnostics: BuildDiagnostics;
  /** Films resolved from the request, in slot order. */
  movies: NormalizedFilm[];
}
