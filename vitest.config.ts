import { defineConfig } from "vitest/config";
import path from "path";

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
  test: {
    include: ["server/test/**/*.test.ts"],
    environment: "node",
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
