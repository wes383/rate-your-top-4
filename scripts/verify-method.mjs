/**
 * Integrity check for the /method documentation data.
 *
 * The page content lives in `lib/method-content.ts` as structured data, so it
 * can rot silently: a table row with the wrong number of cells renders
 * misaligned, and a locale missing a section only fails when someone switches
 * language. This asserts both, without a test framework.
 *
 * Run: node scripts/verify-method.mjs
 */

import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(projectRoot, ".cache", "verify-method");
mkdirSync(outDir, { recursive: true });

const source = readFileSync(join(projectRoot, "lib", "method-content.ts"), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: "method-content.ts",
}).outputText;

const outFile = join(outDir, "method-content.mjs");
writeFileSync(outFile, compiled);
const { METHOD_DOC } = await import(pathToFileURL(outFile).href);

let failures = 0;
function check(ok, message) {
  if (!ok) {
    failures += 1;
    console.log("FAIL  " + message);
  }
}

const locales = Object.keys(METHOD_DOC);
check(locales.length === 2, "expected 2 locales, got: " + locales.join(", "));

const baseIds = METHOD_DOC[locales[0]].sections.map((s) => s.id);
let blockTotal = 0;

for (const locale of locales) {
  const doc = METHOD_DOC[locale];
  const where = "[" + locale + "]";

  for (const key of ["title", "lead", "toc", "back"]) {
    check(
      typeof doc[key] === "string" && doc[key].length > 0,
      where + " missing " + key
    );
  }

  const ids = doc.sections.map((s) => s.id);
  check(ids.join("|") === baseIds.join("|"), where + " section ids differ from the base locale");

  const seen = new Set();
  for (const section of doc.sections) {
    check(!seen.has(section.id), where + " duplicate section id: " + section.id);
    seen.add(section.id);
    check(section.heading.length > 0, where + " " + section.id + " has an empty heading");
    check(section.blocks.length > 0, where + " " + section.id + " has no blocks");

    let tables = 0;
    let formulas = 0;
    for (const [i, block] of section.blocks.entries()) {
      const tag = where + " " + section.id + "#" + i + " (" + block.kind + ")";
      if (block.kind === "table") {
        tables += 1;
        check(block.head.length > 0, tag + " has an empty header");
        for (const [r, row] of block.rows.entries()) {
          check(
            row.length === block.head.length,
            tag + " row " + r + " has " + row.length + " cells, header has " + block.head.length
          );
          for (const cell of row) {
            check(cell.length > 0, tag + " row " + r + " contains an empty cell");
          }
        }
      } else if (block.kind === "formula") {
        formulas += 1;
        check(block.text.length > 0, tag + " has an empty formula");
      } else if (block.kind === "list") {
        check(block.items.length > 0, tag + " has an empty list");
        for (const item of block.items) {
          check(item.length > 0, tag + " contains an empty list item");
        }
      } else {
        check(block.text.length > 0, tag + " has empty text");
      }
    }
    blockTotal += section.blocks.length;
    console.log(
      "  " +
        where +
        " " +
        section.id.padEnd(12) +
        " blocks=" +
        String(section.blocks.length).padStart(2) +
        "  tables=" +
        tables +
        "  formulas=" +
        formulas
    );
  }
}

if (failures === 0) {
  console.log(
    "\nPASS  " +
      baseIds.length +
      " sections / " +
      blockTotal +
      " blocks, both locales structurally identical"
  );
} else {
  console.log("\n" + failures + " check(s) failed");
}
process.exit(failures === 0 ? 0 : 1);
