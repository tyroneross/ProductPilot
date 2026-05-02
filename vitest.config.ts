import { defineConfig } from "vitest/config";
import path from "path";
import react from "@vitejs/plugin-react";

/**
 * Vitest scaffold landed in Phase 1 of the adaptive-intake plan.
 *
 * Why we picked Vitest over Jest:
 *   - Native ESM + TS via tsx — matches the rest of the dev tooling here.
 *   - Per-file isolation by default; no global state surprises.
 *   - Same path-alias config we use in tsconfig.json.
 *
 * Tests live under server/test/. Naming convention: `*.test.ts`.
 *
 * The integration test for RLS (server/test/rls-spec-artifacts.test.ts)
 * skips itself when TEST_DATABASE_URL is unset; CI sets it. See the
 * [CLEANUP] register in the Phase 1 completion report for the open item
 * to wire that env var into local dev.
 */
export default defineConfig({
  // @vitejs/plugin-react handles the JSX transform for *.test.tsx component tests.
  // tsconfig has `jsx: preserve` (Vite's responsibility); without this plugin Vitest's
  // esbuild leaves JSX raw and tests fail with "React is not defined".
  plugins: [react()],
  test: {
    include: ["server/test/**/*.test.ts", "server/test/**/*.test.tsx"],
    // Default to node — most server tests don't need a DOM.
    // *.test.tsx files (Phase 2 component tests) flip to jsdom via environmentMatchGlobs.
    environment: "node",
    environmentMatchGlobs: [
      ["server/test/**/*.test.tsx", "jsdom"],
    ],
    globals: false,
    testTimeout: 15000,
  },
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "shared"),
      "@": path.resolve(__dirname, "client/src"),
    },
  },
});
