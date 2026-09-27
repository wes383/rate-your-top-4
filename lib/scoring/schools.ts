import type { SchoolKey } from "@/lib/types";

/**
 * Named build archetypes ("schools") detected from the same signals the five
 * build dimensions already compute — a thin, explainable layer on top of the
 * engine, never a second scorer. Schools never feed back into the total.
 *
 * Every rule is a conjunction of thresholds on values that are already on the
 * report (sub-metrics, attributes, rule adjustments), so a school verdict can
 * always be traced back to numbers the user can see. Motivation-based
 * archetypes — nostalgia, irony, contrarianism — are deliberately absent:
 * the data cannot see intent, and pretending otherwise would be a verdict on
 * the person rather than the build.
 *
 * `SCHOOL_ORDER` is most-specific first. `detectSchools` returns every match
 * in that order; the first entry is the primary school shown in the report.
 */

export const SCHOOL_ORDER: SchoolKey[] = [
  "franchise",
  "auteurSpecialist",
  "genreSpecialist",
  "oldSchool",
  "youngCinephile",
  "internationalHunter",
  "chaosDraw",
  "ultimateMixer",
  "hotColdMixer",
  "awardsSeason",
  "cinephileStandard",
  "artHouse",
  "cinephile",
  "crowdPleaser",
  "comfortViewer",
  "niche",
];

export const SCHOOL_RULES = {
  /** Era buckets before 1970, as produced by `eraOf`. */
  classicEras: ["pre1930s", "1930s50s", "1960s70s"],
  modernEras: ["2010s", "2020s"],
  eraSchoolMinFilms: 3,
  /** Comedy, romance, family, animation, music. */
  comfortGenreIds: [35, 10749, 10751, 16, 10402],
  rules: {
    auteurSpecialist: { minDirectorRepeat: 3 },
    genreSpecialist: { minGenreConcentration: 55 },
    internationalHunter: { minNonEnglishFilms: 3, minDistinctLanguages: 2 },
    chaosDraw: { minVariety: 65, maxCoherence: 48, maxDirectorSignature: 25 },
    ultimateMixer: { minVariety: 70, minCoherence: 55, minMainstreamMix: 60 },
    hotColdMixer: { minMainstreamMix: 60, minRecognitionSpreadTerm: 45 },
    awardsSeason: { minAwardsPrestige: 70, minOscarFilms: 2 },
    cinephileStandard: {
      minFilmCriticism: 65,
      minPublicConsensus: 60,
      minHistoricalDepth: 55,
      maxIdentity: 45,
    },
    artHouse: { minFilmCriticism: 60, maxPublicConsensus: 55, minGap: 15 },
    cinephile: { minFilmCriticism: 60, minDirectorRepeat: 2, maxPublicConsensus: 65 },
    crowdPleaser: { minPublicConsensus: 70, maxFilmCriticism: 55, maxMainstreamMix: 35 },
    comfortViewer: { minComfortFilms: 3, minPublicConsensus: 50 },
    niche: { maxImdbVotesPts: 24, maxTmdbVotesPts: 22, minFilmsWithData: 3 },
  },
} as const;

/** Everything the detector reads, all of it already computed by the engine. */
export interface SchoolInput {
  eraList: string[];
  /** Number of films whose original language is not English. */
  nonEnglishFilms: number;
  distinctLanguages: number;
  /** Films carrying at least one comfort genre (comedy/family/romance/…). */
  comfortFilms: number;
  maxDirectorRepeat: number;
  directorSignature: number;
  genreConcentration: number | null;
  variety: number;
  coherence: number;
  identity: number;
  mainstreamMix: number;
  filmCriticism: number | null;
  publicConsensus: number | null;
  awardsPrestige: number | null;
  historicalDepth: number;
  /** recognition.spread sub-score (already capped at 100). */
  recognitionSpreadTerm: number;
  /** The sameCollection rule adjustment fired. */
  sameCollection: boolean;
  /** Films with an Oscar win in any tracked category. */
  oscarFilms: number;
  /** Footprint vote-count points (0-40 IMDb / 0-30 TMDB), null when unknown. */
  filmVotePts: { imdb: number | null; tmdb: number | null }[];
}

export function detectSchools(input: SchoolInput): SchoolKey[] {
  const r = SCHOOL_RULES.rules;
  const classicFilms = input.eraList.filter((era) =>
    (SCHOOL_RULES.classicEras as readonly string[]).includes(era)
  ).length;
  const modernFilms = input.eraList.filter((era) =>
    (SCHOOL_RULES.modernEras as readonly string[]).includes(era)
  ).length;

  const nicheVotes = input.filmVotePts.filter(
    (pts) => pts.imdb !== null || pts.tmdb !== null
  );
  const niche =
    nicheVotes.length >= SCHOOL_RULES.rules.niche.minFilmsWithData &&
    nicheVotes.every(
      (pts) =>
        (pts.imdb === null || pts.imdb <= r.niche.maxImdbVotesPts) &&
        (pts.tmdb === null || pts.tmdb <= r.niche.maxTmdbVotesPts)
    );

  const matches: Record<SchoolKey, boolean> = {
    franchise: input.sameCollection,
    auteurSpecialist:
      input.maxDirectorRepeat >= r.auteurSpecialist.minDirectorRepeat,
    genreSpecialist:
      input.genreConcentration !== null &&
      input.genreConcentration >= r.genreSpecialist.minGenreConcentration,
    oldSchool: classicFilms >= SCHOOL_RULES.eraSchoolMinFilms,
    youngCinephile: modernFilms >= SCHOOL_RULES.eraSchoolMinFilms,
    internationalHunter:
      input.nonEnglishFilms >= r.internationalHunter.minNonEnglishFilms &&
      input.distinctLanguages >= r.internationalHunter.minDistinctLanguages,
    chaosDraw:
      input.variety >= r.chaosDraw.minVariety &&
      input.coherence <= r.chaosDraw.maxCoherence &&
      input.directorSignature <= r.chaosDraw.maxDirectorSignature,
    ultimateMixer:
      input.variety >= r.ultimateMixer.minVariety &&
      input.coherence >= r.ultimateMixer.minCoherence &&
      input.mainstreamMix >= r.ultimateMixer.minMainstreamMix,
    hotColdMixer:
      input.mainstreamMix >= r.hotColdMixer.minMainstreamMix &&
      input.recognitionSpreadTerm >= r.hotColdMixer.minRecognitionSpreadTerm,
    awardsSeason:
      input.awardsPrestige !== null &&
      input.awardsPrestige >= r.awardsSeason.minAwardsPrestige &&
      input.oscarFilms >= r.awardsSeason.minOscarFilms,
    cinephileStandard:
      input.filmCriticism !== null &&
      input.publicConsensus !== null &&
      input.filmCriticism >= r.cinephileStandard.minFilmCriticism &&
      input.publicConsensus >= r.cinephileStandard.minPublicConsensus &&
      input.historicalDepth >= r.cinephileStandard.minHistoricalDepth &&
      input.identity <= r.cinephileStandard.maxIdentity,
    artHouse:
      input.filmCriticism !== null &&
      input.publicConsensus !== null &&
      input.filmCriticism >= r.artHouse.minFilmCriticism &&
      input.publicConsensus <= r.artHouse.maxPublicConsensus &&
      input.filmCriticism - input.publicConsensus >= r.artHouse.minGap,
    cinephile:
      input.filmCriticism !== null &&
      input.publicConsensus !== null &&
      input.filmCriticism >= r.cinephile.minFilmCriticism &&
      input.maxDirectorRepeat >= r.cinephile.minDirectorRepeat &&
      input.publicConsensus <= r.cinephile.maxPublicConsensus,
    crowdPleaser:
      input.filmCriticism !== null &&
      input.publicConsensus !== null &&
      input.publicConsensus >= r.crowdPleaser.minPublicConsensus &&
      input.filmCriticism <= r.crowdPleaser.maxFilmCriticism &&
      input.mainstreamMix <= r.crowdPleaser.maxMainstreamMix,
    comfortViewer:
      input.comfortFilms >= SCHOOL_RULES.rules.comfortViewer.minComfortFilms &&
      input.publicConsensus !== null &&
      input.publicConsensus >= SCHOOL_RULES.rules.comfortViewer.minPublicConsensus,
    niche,
  };

  return SCHOOL_ORDER.filter((key) => matches[key]);
}
