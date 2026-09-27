/**
 * The copy-paste prompt that users send to an external AI.
 *
 * The text lives in `data/` as markdown, one file per locale, and is read from
 * disk at request time rather than duplicated into the bundle — so the markdown
 * stays the single source of truth and editing it is enough to change the page.
 * `next.config.ts` lists the same glob under `outputFileTracingIncludes` so the
 * directory survives an output-file-trace build.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Lang } from "@/lib/i18n";

export const PROMPT_DIR = "data";

export const PROMPT_FILE: Record<Lang, string> = {
  zh: "movie-taste-build.zh-CN.md",
  en: "movie-taste-build.en-US.md",
};

/**
 * Prompt text per locale. A missing file yields an empty string so the page can
 * still render and say so, instead of throwing a 500.
 */
export function readPrompts(): Record<Lang, string> {
  const read = (lang: Lang): string => {
    try {
      return readFileSync(
        join(process.cwd(), PROMPT_DIR, PROMPT_FILE[lang]),
        "utf8"
      ).trim();
    } catch {
      return "";
    }
  };
  return { zh: read("zh"), en: read("en") };
}
