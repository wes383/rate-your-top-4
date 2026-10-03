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
 * in that order; the report shows the first entry only, so the verdict stays a
 * single answer instead of a pile of labels.
 *
 * Ordering follows "structure first, style second, composition and era last":
 * a structural fact (same collection, same director, one genre) names the build
 * most precisely; the style schools describe which kind of cinema it is; and
 * the purely compositional signals — crossing borders, spanning decades — are
 * consequences that any art-house lineup satisfies by accident. The two era
 * schools sit at the very bottom on purpose: "three films from the 1950s" is a
 * fact about *when* a build points at, not about what taste it expresses, and
 * ranking it high made a Sight & Sound top-10 lineup read as "The Old School"
 * instead of "The Cinephile Correct Answers". Both only surface when nothing
 * more specific applies.
 */

export const SCHOOL_ORDER: SchoolKey[] = [
  "franchise",
  "auteurSpecialist",
  "genreSpecialist",
  // Art-house ranks above the composition schools: it is the only style school
  // whose conjunction reads critics'-list standing *and* low popularity, so it
  // says more about the build than "these films cross borders" or "these films
  // are old". Without this, a Cléo / Persona / Potemkin / Joan of Arc lineup
  // came back as The International Hunter.
  "artHouse",
  "internationalHunter",
  "chaosDraw",
  "ultimateMixer",
  "hotColdMixer",
  "awardsSeason",
  "cinephileStandard",
  "cinephile",
  "crowdPleaser",
  "comfortViewer",
  "niche",
  // Era schools last: a time range is the weakest thing a build can be named
  // after (see the note above).
  "oldSchool",
  "youngCinephile",
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
      minPublicConsensus: 60,
      minMeanLegacy: 60,
    },
    artHouse: { minMeanLegacy: 40, maxMeanHeat: 58, minFilmsWithData: 3 },
    cinephile: { minFilmCriticism: 60, minDirectorRepeat: 2, maxPublicConsensus: 65 },
    crowdPleaser: {
      minPublicConsensus: 70,
      maxFilmCriticism: 55,
      maxMainstreamMix: 35,
      maxLegacyScore: 10,
    },
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
  /** Highest per-film legacy score (TSPDT / Sight & Sound / Cahiers) in the
   *  build, 0-100. The crowd-pleaser gate: mass favourites carry no
   *  critics'-list standing, so any listed film rules the school out. */
  maxLegacy: number;
  /** Mean per-film legacy score across the build, 0-100. The canon signal:
   *  the correct-answers school reads this directly instead of the IMDb-heavy
   *  filmCriticism attribute, which cannot see critics'-list standing. */
  meanLegacy: number;
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

  // Art-house reads the public side from HEAT (vote counts), not from ratings:
  // IMDb raters are self-selected, so slow-cinema favourites still average 7+;
  // what marks them out is that few people rated them at all. The critics
  // side is meanLegacy — softer than the correct-answers bar, because
  // art-house canon lives in the middle of the lists, not at the top.
  const meanHeat =
    nicheVotes.length >= SCHOOL_RULES.rules.artHouse.minFilmsWithData
      ? nicheVotes.reduce(
          (acc, pts) => acc + (pts.imdb ?? 0) + (pts.tmdb ?? 0),
          0
        ) / nicheVotes.length
      : null;

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
      input.publicConsensus !== null &&
      input.publicConsensus >= r.cinephileStandard.minPublicConsensus &&
      input.meanLegacy >= r.cinephileStandard.minMeanLegacy,
    artHouse:
      meanHeat !== null &&
      input.meanLegacy >= r.artHouse.minMeanLegacy &&
      meanHeat <= r.artHouse.maxMeanHeat,
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
      input.mainstreamMix <= r.crowdPleaser.maxMainstreamMix &&
      input.maxLegacy <= r.crowdPleaser.maxLegacyScore,
    comfortViewer:
      input.comfortFilms >= SCHOOL_RULES.rules.comfortViewer.minComfortFilms &&
      input.publicConsensus !== null &&
      input.publicConsensus >= SCHOOL_RULES.rules.comfortViewer.minPublicConsensus,
    niche,
  };

  return SCHOOL_ORDER.filter((key) => matches[key]);
}
