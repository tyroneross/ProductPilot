/**
 * Vitest globalSetup wrapper for the RLS sandbox.
 *
 * Vitest 2.x calls the default export once before any test file loads, and
 * the returned function once after all suites finish. We use it to:
 *   1. Create the ephemeral Postgres sandbox.
 *   2. Stash the connection string in `process.env.RLS_SANDBOX_URL` so the
 *      test file can pick it up (vitest workers inherit env from globalSetup
 *      via `provide()` or env vars; env-var plumbing is the simplest path).
 *   3. Drop the sandbox DB on teardown.
 *
 * Gating: globalSetup is only wired in vitest.config.ts when
 * `RLS_SANDBOX=1` is set, so the default `npm run test` path never imports
 * this module.
 */

import { setupSandboxDb, teardownSandboxDb, type SandboxHandle } from "./postgres-sandbox";

let handle: SandboxHandle | null = null;

export default async function setup() {
  handle = await setupSandboxDb();
  process.env.RLS_SANDBOX_URL = handle.connectionString;
  process.env.RLS_SANDBOX_APP_ROLE = handle.appRole;
  return async () => {
    if (handle) {
      await teardownSandboxDb(handle);
      handle = null;
    }
  };
}
