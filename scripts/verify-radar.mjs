/**
 * Verify the radar chart's label layout: no axis label may cross the edge of
 * the SVG box, in either locale.
 *
 * The geometry lives in `lib/radar-layout.ts`, which needs no DOM, and the
 * labels come from the real i18n dictionary — so this checks what actually
 * ships. The axis keys are read from the scoring engine, and every permutation
 * of the labels is tested, so the result does not depend on the order the
 * dimensions happen to be in.
 *
 * There is no test runner in this project, so the modules are compiled with the
 * local TypeScript compiler into a temp directory (the `@/` path alias is
 * rewritten) and executed there.
 *
 * Usage: node scripts/verify-radar.mjs
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
// project's node_modules.
const outRoot = join(projectRoot, ".cache", "verify-radar");
rmSync(outRoot, { recursive: true, force: true });
mkdirSync(outRoot, { recursive: true });

const sources = [
  "lib/utils.ts",
  "lib/types.ts",
  "lib/scoring/constants.ts",
  "lib/scoring/film.ts",
  "lib/scoring/build.ts",
  "lib/scoring/index.ts",
  "lib/radar-layout.ts",
  "lib/i18n.ts",
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

/* ── Inputs, read from the real sources ───────────────────────── */

const { analyzeBuild } = require(join(outRoot, "lib/scoring/index.js"));
const { dict } = require(join(outRoot, "lib/i18n.js"));
const { radarLayout, RADAR_LABEL_PADDING } = require(join(outRoot, "lib/radar-layout.js"));

const demoFilms = JSON.parse(readFileSync(join(projectRoot, "data/demo-films.json"), "utf8"));
const axisKeys = analyzeBuild(demoFilms).build.dimensions.map((dimension) => dimension.key);

const reportSource = readFileSync(join(projectRoot, "components/build-report.tsx"), "utf8");
const sizeMatch = reportSource.match(/<RadarChart\s+size=\{(\d+)\}/);
if (!sizeMatch) {
  console.error("could not read the RadarChart `size` prop from components/build-report.tsx");
  process.exit(1);
}
const size = Number(sizeMatch[1]);

/* ── Checks ───────────────────────────────────────────────────── */

function permutations(items) {
  if (items.length <= 1) return [items];
  const out = [];
  items.forEach((item, index) => {
    const rest = [...items.slice(0, index), ...items.slice(index + 1)];
    for (const tail of permutations(rest)) out.push([item, ...tail]);
  });
  return out;
}

/** Signed distance from each side of the label box to the SVG edge. */
const marginsOf = (label) => [
  label.x - label.halfWidth - RADAR_LABEL_PADDING,
  size - RADAR_LABEL_PADDING - (label.x + label.halfWidth),
  label.y - label.halfHeight - RADAR_LABEL_PADDING,
  size - RADAR_LABEL_PADDING - (label.y + label.halfHeight),
];

const FIXED_INSET_RADIUS = size / 2 - 34; // the old hardcoded radius, for reference

console.log(`size=${size}  axes=${axisKeys.join(", ")}\n`);

let failures = 0;

for (const locale of ["zh", "en"]) {
  const labels = axisKeys.map((key) => {
    const label = dict[locale]?.dim?.[key];
    if (typeof label !== "string") throw new Error(`missing label: ${locale}.dim.${key}`);
    return label;
  });

  // Actual axis order: the one the app renders.
  const actual = radarLayout(labels, size);
  console.log(`── ${locale} ──  radius=${actual.radius.toFixed(2)} (fixed-radius inset would be ${FIXED_INSET_RADIUS.toFixed(2)})`);
  for (let index = 0; index < labels.length; index += 1) {
    const label = actual.labels[index];
    const margins = marginsOf(label);
    const worst = Math.min(...margins);
    const ok = worst >= -1e-6;
    if (!ok) failures += 1;
    console.log(
      `  ${ok ? "ok  " : "FAIL"} ${labels[index].padEnd(20)} ` +
        `${String(label.lines.length)} line(s)  ` +
        `x=[${(label.x - label.halfWidth).toFixed(1)}, ${(label.x + label.halfWidth).toFixed(1)}]  ` +
        `y=[${(label.y - label.halfHeight).toFixed(1)}, ${(label.y + label.halfHeight).toFixed(1)}]  ` +
        `margin=${worst.toFixed(2)}`
    );
  }

  // Every permutation, so the result holds whatever order the axes end up in.
  let tightest = Infinity;
  let smallestRadius = Infinity;
  for (const order of permutations(labels)) {
    const layout = radarLayout(order, size);
    smallestRadius = Math.min(smallestRadius, layout.radius);
    for (const label of layout.labels) {
      const worst = Math.min(...marginsOf(label));
      tightest = Math.min(tightest, worst);
      if (worst < -1e-6) failures += 1;
    }
  }
  console.log(
    `  all ${permutations(labels).length} permutations: ` +
      `radius >= ${smallestRadius.toFixed(2)}, tightest margin=${tightest.toFixed(2)} ` +
      `(need >= ${RADAR_LABEL_PADDING})\n`
  );
}

console.log(failures === 0 ? "PASS — no axis label crosses the SVG edge" : `FAIL — ${failures} label box(es) clipped`);
process.exit(failures === 0 ? 0 : 1);
