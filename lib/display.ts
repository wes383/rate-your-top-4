import { GENRE_NAMES_ZH, type Lang } from "@/lib/i18n";
import type { NormalizedFilm } from "@/lib/types";

/** Client-safe display helpers: locale-aware labels for codes and titles. */

/** Preferred localized title, falling back to the original. */
export function displayTitle(
  entry: Pick<NormalizedFilm, "title" | "titleZh"> | { title: string; titleZh: string | null },
  lang: Lang
): string {
  if (lang === "zh" && entry.titleZh) return entry.titleZh;
  return entry.title;
}

/** Secondary title line: the alternative language title when it differs. */
export function secondaryTitle(
  entry: { title: string; titleZh: string | null },
  lang: Lang
): string | null {
  const primary = displayTitle(entry, lang);
  const alternative = lang === "zh" ? entry.title : entry.titleZh;
  if (!alternative || alternative === primary) return null;
  return alternative;
}

/** Preferred overview text. */
export function displayOverview(
  entry: Pick<NormalizedFilm, "overview" | "overviewZh">,
  lang: Lang
): string | null {
  return (lang === "zh" ? entry.overviewZh || entry.overview : entry.overview) ?? null;
}

/** BCP-47 locale for a UI language, for Intl.NumberFormat / Intl.DisplayNames. */
export function localeOf(lang: Lang): string {
  return lang === "zh" ? "zh-CN" : "en-US";
}

/** Data-confidence band for a 0-100 score. */
export function confidenceBand(score: number): "high" | "medium" | "low" | "invalid" {
  if (score >= 85) return "high";
  if (score >= 65) return "medium";
  if (score >= 40) return "low";
  return "invalid";
}

const languageNames = new Map<string, Intl.DisplayNames | null>();

/** Localized language name for an ISO 639-1 code ("ko" → "韩语" / "Korean"). */
export function languageName(code: string | null, lang: Lang): string | null {
  if (!code) return null;
  const locale = lang === "zh" ? "zh-CN" : "en";
  if (!languageNames.has(locale)) {
    try {
      languageNames.set(locale, new Intl.DisplayNames([locale], { type: "language" }));
    } catch {
      languageNames.set(locale, null);
    }
  }
  const display = languageNames.get(locale);
  try {
    return display?.of(code) ?? code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}

const regionNames = new Map<string, Intl.DisplayNames | null>();

/** Localized country name for an ISO 3166-1 alpha-2 code ("KR" → "韩国"). */
export function countryName(code: string, lang: Lang): string {
  const locale = lang === "zh" ? "zh-CN" : "en";
  if (!regionNames.has(locale)) {
    try {
      regionNames.set(locale, new Intl.DisplayNames([locale], { type: "region" }));
    } catch {
      regionNames.set(locale, null);
    }
  }
  const display = regionNames.get(locale);
  try {
    return display?.of(code) ?? code;
  } catch {
    return code;
  }
}

/** Genre label: the zh lookup table when available, else the TMDB name. */
export function genreLabel(id: number, englishName: string, lang: Lang): string {
  if (lang === "zh" && GENRE_NAMES_ZH[id]) return GENRE_NAMES_ZH[id];
  return englishName;
}
