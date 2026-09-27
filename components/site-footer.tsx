"use client";

import Link from "next/link";
import { Moon, Sun } from "lucide-react";
import { LANGUAGES, type Lang } from "@/lib/i18n";
import { useI18n, useTheme } from "@/components/providers";
import { useHydrated } from "@/components/use-hydrated";
import { cn } from "@/lib/utils";

/**
 * Bottom control bar: page links on the left, language and appearance controls
 * on the right. Sits in normal flow at the end of the page.
 *
 * The language toggle's buttons sit inside the group's `p-0.5` inset, so their
 * radius must be the group's radius minus that inset (rounded-md is 12px here,
 * so the buttons use 10px). Equal radii would read as a bulge at the corners.
 */
export function SiteFooter() {
  const { t, lang, setLang } = useI18n();
  const { theme, setTheme } = useTheme();
  // The theme class only becomes readable after hydration.
  const mounted = useHydrated();
  const isDark = mounted ? theme === "dark" : false;

  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto flex min-h-14 max-w-[1200px] items-center justify-between gap-4 px-6 py-2 lg:px-8">
        <nav className="-ml-2 flex items-center gap-1" aria-label={t("footer.nav")}>
          <Link
            href="/method"
            className="inline-flex items-center rounded-md px-2 py-1.5 text-xs font-medium text-foreground-muted transition-colors hover:bg-hover-bg hover:text-foreground"
          >
            {t("footer.method")}
          </Link>
          <Link
            href="/prompt"
            className="inline-flex items-center rounded-md px-2 py-1.5 text-xs font-medium text-foreground-muted transition-colors hover:bg-hover-bg hover:text-foreground"
          >
            {t("footer.prompt")}
          </Link>
          <Link
            href="/about"
            className="inline-flex items-center rounded-md px-2 py-1.5 text-xs font-medium text-foreground-muted transition-colors hover:bg-hover-bg hover:text-foreground"
          >
            {t("footer.about")}
          </Link>
          <Link
            href="/privacy"
            className="inline-flex items-center rounded-md px-2 py-1.5 text-xs font-medium text-foreground-muted transition-colors hover:bg-hover-bg hover:text-foreground"
          >
            {t("footer.privacy")}
          </Link>
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <div
            className="inline-flex items-center rounded-md border border-border bg-surface p-0.5"
            role="group"
            aria-label={t("toggle.language")}
          >
            {LANGUAGES.map((option) => (
              <button
                key={option.code}
                type="button"
                onClick={() => setLang(option.code as Lang)}
                aria-pressed={lang === option.code}
                className={cn(
                  "h-7 rounded-[10px] px-2.5 text-xs font-medium transition-colors",
                  lang === option.code
                    ? "bg-foreground text-accent-fg"
                    : "text-foreground-muted hover:text-foreground"
                )}
              >
                {option.short}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            aria-label={t("toggle.theme")}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface text-foreground-muted transition-colors hover:bg-hover-bg hover:text-foreground"
          >
            {isDark ? (
              <Moon className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Sun className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
    </footer>
  );
}
