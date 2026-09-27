/**
 * SSR smoke test for the preference providers.
 *
 * Renders the provider tree with react-dom/server to prove that server
 * rendering never reaches for a browser API. The second pass installs a
 * `window` whose localStorage and addEventListener throw, so an accidental
 * `getSnapshot()` / `subscribe()` call during SSR fails loudly instead of
 * quietly falling back to the server value.
 *
 * Run: node scripts/verify-render.mjs
 */
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(projectRoot, ".cache", "verify-render");

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

/** Source files under test, mirroring their location in the emitted tree. */
const sources = ["lib/i18n.ts", "lib/prefs.ts", "components/providers.tsx"];

const emitted = new Map();
for (const rel of sources) {
  const source = readFileSync(join(projectRoot, rel), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
    fileName: rel,
  });
  emitted.set(rel, outputText);
}

/** Rewrite `@/x` specifiers to paths relative to the importing file. */
function rewriteAliases(rel, code) {
  return code.replace(/(["'])@\/([^"']+)\1/g, (match, quote, spec) => {
    const from = join(outDir, dirname(rel));
    let href = relative(from, join(outDir, `${spec}.js`)).replace(/\\/g, "/");
    if (!href.startsWith(".")) href = `./${href}`;
    return `${quote}${href}${quote}`;
  });
}

for (const [rel, code] of emitted) {
  const target = join(outDir, rel.replace(/\.tsx?$/, ".js"));
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, rewriteAliases(rel, code), "utf8");
}

const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { LanguageProvider, ThemeProvider, useI18n, useTheme } = require(
  join(outDir, "components", "providers.js")
);

/** Reads both contexts and flattens them into one comparable string. */
function Probe() {
  const { theme } = useTheme();
  const { lang, t } = useI18n();
  return React.createElement("span", null, `${theme}|${lang}|${t("builder.title")}`);
}

function render() {
  return renderToStaticMarkup(
    React.createElement(
      ThemeProvider,
      { initialTheme: "dark" },
      React.createElement(
        LanguageProvider,
        { initialLang: "en" },
        React.createElement(Probe)
      )
    )
  );
}

const results = [];
function check(label, actual, expected) {
  const ok = actual === expected;
  results.push(ok);
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${label}\n      got  ${JSON.stringify(actual)}\n      want ${JSON.stringify(expected)}`
  );
}

// The server snapshot wins while rendering on the server, so the values come
// from the props the root layout read out of cookies.
const EXPECTED = "<span>dark|en|Rate Your Top 4</span>";

check("SSR without window", render(), EXPECTED);

globalThis.window = {
  localStorage: {
    getItem() {
      throw new Error("localStorage read during SSR");
    },
  },
  addEventListener() {
    throw new Error("subscribe() called during SSR");
  },
  removeEventListener() {},
};
check("SSR never touches storage", render(), EXPECTED);

delete globalThis.window;

console.log(`\n${results.filter(Boolean).length}/${results.length} checks passed`);
process.exit(results.every(Boolean) ? 0 : 1);
