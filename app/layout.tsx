import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Manrope, Noto_Sans_SC } from "next/font/google";
import { cookies } from "next/headers";
import { LanguageProvider, ThemeProvider } from "@/components/providers";
import type { Lang } from "@/lib/i18n";
import {
  DEFAULT_LANG,
  DEFAULT_THEME,
  LANG_STORAGE_KEY,
  THEME_INIT_SCRIPT,
  THEME_STORAGE_KEY,
  type Theme,
} from "@/lib/prefs";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-manrope",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

// Source Han Sans supplies CJK glyphs for the sans / display / mono stacks.
// `preload: false` keeps the (large) CJK font off the critical path.
const notoSansSC = Noto_Sans_SC({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-noto-sans-sc",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: "Rate Your Top 4",
  description:
    "Quantify your Top 4 movie build with TMDB, IMDb, awards and all-time list data.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fcfbfa" },
    { media: "(prefers-color-scheme: dark)", color: "#101010" },
  ],
  width: "device-width",
  initialScale: 1,
};

async function readPreferences(): Promise<{ lang: Lang; theme: Theme }> {
  const store = await cookies();
  const langValue = store.get(LANG_STORAGE_KEY)?.value;
  const themeValue = store.get(THEME_STORAGE_KEY)?.value;
  return {
    lang: langValue === "en" || langValue === "zh" ? langValue : DEFAULT_LANG,
    theme: themeValue === "dark" || themeValue === "light" ? themeValue : DEFAULT_THEME,
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { lang, theme } = await readPreferences();

  return (
    <html
      lang={lang === "zh" ? "zh-CN" : "en"}
      className={theme === "dark" ? "dark" : undefined}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body
        className={`${inter.variable} ${manrope.variable} ${jetbrainsMono.variable} ${notoSansSC.variable} antialiased`}
      >
        <ThemeProvider initialTheme={theme}>
          <LanguageProvider initialLang={lang}>{children}</LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
