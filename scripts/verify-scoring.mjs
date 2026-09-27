/**
 * Verify the scoring engine against the worked example in 打分算法.md.
 *
 * There is no test runner in this project, so this script compiles `lib/`
 * with the local TypeScript compiler into a temp directory (the `@/` path
 * alias is rewritten) and executes the engine there.
 *
 * The "doc" values below are a frozen snapshot of the worked example in
 * 打分算法.md (kept in sync with it). They are not a second source of truth:
 * they exist so that any future change to the engine shows up as a non-zero
 * delta instead of passing silently.
 *
 * Usage: node scripts/verify-scoring.mjs
 */
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// Emit inside the project tree, not the OS temp dir: the compiled modules pull
// in real dependencies (clsx, tailwind-merge via lib/utils.ts), which only
// resolve if the output sits under a directory that can walk up to the
// project's node_modules. `.cache/` is gitignored and is not picked up by tsc,
// Next or Tailwind's content scan.
const outRoot = join(projectRoot, ".cache", "verify-scoring");
rmSync(outRoot, { recursive: true, force: true });
mkdirSync(outRoot, { recursive: true });

const sources = [
  "lib/utils.ts",
  "lib/types.ts",
  "lib/scoring/constants.ts",
  "lib/scoring/film.ts",
  "lib/scoring/build.ts",
  "lib/scoring/schools.ts",
  "lib/scoring/index.ts",
];

/** Rewrite the `@/` alias into a path relative to the emitted file. */
function rewriteAlias(code, outFile) {
  return code.replace(/require\("@\/([^"]+)"\)/g, (_match, spec) => {
    const target = join(outRoot, `${spec}.js`);
    let rel = relative(dirname(outFile), target).replace(/\\/g, "/");
    if (!rel.startsWith(".")) rel = `./${rel}`;
    return `require("${rel}")`;
  });
}

for (const source of sources) {
  const abs = join(projectRoot, source);
  const outFile = join(outRoot, source.replace(/\.ts$/, ".js"));
  mkdirSync(dirname(outFile), { recursive: true });

  const { outputText } = ts.transpileModule(readFileSync(abs, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: source,
  });
  writeFileSync(outFile, rewriteAlias(outputText, outFile), "utf8");
}

writeFileSync(join(outRoot, "package.json"), JSON.stringify({ type: "commonjs" }), "utf8");

const { analyzeBuild } = require(join(outRoot, "lib/scoring/index.js"));
const demoFilms = JSON.parse(
  readFileSync(join(projectRoot, "data/demo-films.json"), "utf8")
);

const result = analyzeBuild(demoFilms);

/* ── Report ───────────────────────────────────────────────────── */

const expectedFilm = {
  496243: { total: 88.1, tier: "S" },
  238: { total: 74.8, tier: "S" },
  129: { total: 77.3, tier: "S" },
  115: { total: 54.3, tier: "A" },
};

console.log("── Per-film scores ────────────────────────────────────────");
for (const film of result.films) {
  const movie = demoFilms.find((m) => m.tmdbId === film.tmdbId);
  const contrib = film.dimensions
    .map(
      (d) =>
        `${d.key}=${d.score === null ? "N/A" : d.score.toFixed(1)}→${d.contribution.toFixed(1)}`
    )
    .join("  ");
  const exp = expectedFilm[film.tmdbId];
  const delta = exp ? (film.total - exp.total).toFixed(1) : "n/a";
  console.log(
    `${(movie.titleZh ?? movie.title).padEnd(9)} ${film.total.toFixed(1).padStart(5)} ${film.tier}` +
      `  (doc ${exp ? exp.total.toFixed(1) : "-"}, Δ${delta})  ${contrib}`
  );
}

console.log("\n── Build dimensions ───────────────────────────────────────");
const expectedBuild = {
  quality: 18.4,
  variety: 21.8,
  coherence: 13.5,
  identity: 4.3,
  recognition: 10.2,
};
for (const d of result.build.dimensions) {
  console.log(
    `${d.key.padEnd(12)} score=${String(d.score).padStart(5)} ` +
      `contr=${d.contribution.toFixed(1).padStart(5)} / ${(d.weight * 100).toFixed(0)}%` +
      `   (doc ${expectedBuild[d.key] ?? "-"})`
  );
  for (const s of d.sub) {
    console.log(
      `   · ${s.key.padEnd(22)} ${s.score === null ? "N/A" : s.score}`
    );
  }
}

console.log("\n── Adjustments ────────────────────────────────────────────");
for (const a of result.build.adjustments) {
  console.log(`${a.key}: ${a.delta > 0 ? "+" : ""}${a.delta}`);
}

console.log("\n── Attributes ─────────────────────────────────────────────");
for (const [key, value] of Object.entries(result.build.attributes)) {
  console.log(`${key.padEnd(20)} ${value === null ? "N/A" : value}`);
}

console.log("\n── Summary ────────────────────────────────────────────────");
console.log(
  `total=${result.build.total} (doc 73.2)  tier=${result.build.tier}` +
    `  level=${result.build.level}/9 (doc 6)  levelRaw=${result.build.levelRaw}`
);
console.log(`confidence=${result.build.confidence} (${result.build.confidenceLevel})`);
console.log(`diagnostics=${JSON.stringify(result.diagnostics)}`);
