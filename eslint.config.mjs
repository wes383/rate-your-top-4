import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Build output of scripts/verify-scoring.mjs (CommonJS, not source).
    ".cache/**",
    // Vendored design reference only; not part of the app (also excluded in tsconfig).
    "orkest-ui/**",
  ]),
]);

export default eslintConfig;
