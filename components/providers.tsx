"use client";

import * as React from "react";
import { dict, type Dict, type Lang } from "@/lib/i18n";
import {
  LANG_STORAGE_KEY,
  THEME_STORAGE_KEY,
  type Theme,
} from "@/lib/prefs";

/* ── Theme ────────────────────────────────────────────────────── */

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

function applyThemeClass(theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
}

/** Persist the theme to both localStorage and a cookie so SSR can read it. */
export function persistTheme(theme: Theme) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    document.cookie = `${THEME_STORAGE_KEY}=${theme};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
  } catch {
    /* storage unavailable */
  }
}

/**
 * localStorage-backed preference, read through `useSyncExternalStore`.
 *
 * The server snapshot is `null`, so SSR keeps the value it was given while the
 * client picks storage up right after hydration — no state-syncing effect
 * needed. Subscribing to `storage` also keeps other tabs in sync.
 */
function preferenceStore<T extends string>(
  key: string,
  isStoredValue: (raw: string) => boolean
) {
  return {
    subscribe(listener: () => void) {
      window.addEventListener("storage", listener);
      return () => window.removeEventListener("storage", listener);
    },
    get: (): T | null => {
      try {
        const raw = window.localStorage.getItem(key);
        return raw !== null && isStoredValue(raw) ? (raw as T) : null;
      } catch {
        return null;
      }
    },
  };
}

const themeStore = preferenceStore<Theme>(
  THEME_STORAGE_KEY,
  (raw) => raw === "light" || raw === "dark"
);
const langStore = preferenceStore<Lang>(
  LANG_STORAGE_KEY,
  (raw) => raw === "zh" || raw === "en"
);

export function ThemeProvider({
  children,
  initialTheme = "light",
}: {
  children: React.ReactNode;
  initialTheme?: Theme;
}) {
  /** A choice made during this session outranks whatever is in storage. */
  const [picked, setPicked] = React.useState<Theme | null>(null);
  const stored = React.useSyncExternalStore(
    themeStore.subscribe,
    themeStore.get,
    () => null
  );
  const theme = picked ?? stored ?? initialTheme;

  const setTheme = React.useCallback((next: Theme) => {
    setPicked(next);
    applyThemeClass(next);
    persistTheme(next);
  }, []);

  const toggleTheme = React.useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [setTheme, theme]);

  const value = React.useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within <ThemeProvider>");
  return ctx;
}

/* ── Language ─────────────────────────────────────────────────── */

interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const LanguageContext = React.createContext<LanguageContextValue | null>(null);

function flatten(source: Dict): Map<string, string> {
  const map = new Map<string, string>();
  const walk = (node: unknown, prefix: string) => {
    if (typeof node === "string") {
      map.set(prefix, node);
      return;
    }
    if (node && typeof node === "object") {
      for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
        walk(value, prefix ? `${prefix}.${key}` : key);
      }
    }
  };
  walk(source, "");
  return map;
}

const flatDictionaries: Record<Lang, Map<string, string>> = {
  zh: flatten(dict.zh),
  en: flatten(dict.en),
};

export function LanguageProvider({
  children,
  initialLang = "zh",
}: {
  children: React.ReactNode;
  initialLang?: Lang;
}) {
  /** A choice made during this session outranks whatever is in storage. */
  const [picked, setPicked] = React.useState<Lang | null>(null);
  const stored = React.useSyncExternalStore(
    langStore.subscribe,
    langStore.get,
    () => null
  );
  const lang = picked ?? stored ?? initialLang;

  React.useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
    }
  }, [lang]);

  const setLang = React.useCallback((next: Lang) => {
    setPicked(next);
    try {
      window.localStorage.setItem(LANG_STORAGE_KEY, next);
      document.cookie = `${LANG_STORAGE_KEY}=${next};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
    } catch {
      /* ignore */
    }
  }, []);

  const t = React.useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      const raw = flatDictionaries[lang].get(key) ?? key;
      if (!vars) return raw;
      return raw.replace(/\{(\w+)\}/g, (match, name: string) =>
        vars[name] === undefined ? match : String(vars[name])
      );
    },
    [lang]
  );

  const value = React.useMemo(
    () => ({ lang, setLang, t }),
    [lang, setLang, t]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useI18n() {
  const ctx = React.useContext(LanguageContext);
  if (!ctx) throw new Error("useI18n must be used within <LanguageProvider>");
  return ctx;
}
