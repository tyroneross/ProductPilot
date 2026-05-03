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
 * RLS live-run mode: when `RLS_SANDBOX=1` is set (via `npm run test:rls`),
 * `server/test/helpers/rls-global-setup.ts` provisions an ephemeral Postgres
 * database against the local `postgresql@15` Homebrew service, applies all
 * migrations, and exposes the connection string via `RLS_SANDBOX_URL`. The
 * sandbox is dropped on teardown. Default `npm run test` is unaffected; the
 * RLS test file skips itself when neither `RLS_SANDBOX` nor the legacy
 * `TEST_DATABASE_URL` is set. See `server/test/README.md`.
 */
const useRlsSandbox = process.env.RLS_SANDBOX === "1";

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
    // Gated globalSetup: only spin up the Postgres sandbox when explicitly
    // opted in. Avoids burdening the default test path with a DB dependency.
    globalSetup: useRlsSandbox ? ["./server/test/helpers/rls-global-setup.ts"] : [],
  },
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "shared"),
      "@": path.resolve(__dirname, "client/src"),
    },
  },
});
