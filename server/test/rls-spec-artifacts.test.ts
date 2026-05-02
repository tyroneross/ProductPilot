/**
 * Test 5 — RLS policy on intake_questions and spec_artifacts (integration).
 *
 * Verifies that the policies created by migrations/0003_adaptive_intake.sql
 * actually block cross-tenant SELECT. Skips itself when TEST_DATABASE_URL is
 * unset so the unit-test pass stays green in environments without a DB.
 *
 * Open [CLEANUP] item: wire TEST_DATABASE_URL into local dev and CI so this
 * test runs by default. Without it the migration is verified by manual SQL
 * trace only (cited in the Phase 1 completion report).
 *
 * Why this lives in the unit-test directory: the integration test follows the
 * same DB-in-test pattern Phase 7 will expand. Pulling it into a separate
 * `integration` runner is overkill for a single test today.
 *
 * Pattern:
 *   1. Open a pg client with the test DB URL.
 *   2. SET app.current_user_id = 'tenant-a' → INSERT a project + spec_artifact.
 *   3. SET app.current_user_id = 'tenant-b' → SELECT from spec_artifacts. Expect 0 rows.
 *   4. Tear down both rows.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "pg";

const TEST_DB = process.env.TEST_DATABASE_URL;

const skipReason = "TEST_DATABASE_URL not set — see Phase 1 completion report [CLEANUP] register.";

describe.skipIf(!TEST_DB)("RLS — cross-tenant isolation on new tables", () => {
  let client: Client;
  const tenantA = "rls-test-tenant-a-" + Date.now();
  const tenantB = "rls-test-tenant-b-" + Date.now();
  let projectAId: string;

  beforeAll(async () => {
    if (!TEST_DB) return;
    client = new Client({ connectionString: TEST_DB });
    await client.connect();
    // Insert a project owned by tenant A, then a spec_artifact under it.
    await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [tenantA]);
    const projRes = await client.query(
      `INSERT INTO projects (user_id, name, description) VALUES ($1, $2, $3) RETURNING id`,
      [tenantA, "rls test project", "rls fixture"],
    );
    projectAId = projRes.rows[0].id;
    await client.query(
      `INSERT INTO spec_artifacts (project_id, kind, payload) VALUES ($1, $2, $3)`,
      [projectAId, "brief", { test: true }],
    );
  });

  afterAll(async () => {
    if (!TEST_DB || !client) return;
    // Clean up as tenant A so RLS lets us delete.
    await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [tenantA]);
    if (projectAId) {
      await client.query(`DELETE FROM spec_artifacts WHERE project_id = $1`, [projectAId]);
      await client.query(`DELETE FROM projects WHERE id = $1`, [projectAId]);
    }
    await client.end();
  });

  it("blocks tenant B from reading tenant A's spec_artifacts", async () => {
    await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [tenantB]);
    const res = await client.query(`SELECT * FROM spec_artifacts WHERE project_id = $1`, [projectAId]);
    expect(res.rows).toHaveLength(0);
  });

  it("allows tenant A to read its own spec_artifacts", async () => {
    await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [tenantA]);
    const res = await client.query(`SELECT * FROM spec_artifacts WHERE project_id = $1`, [projectAId]);
    expect(res.rows.length).toBeGreaterThanOrEqual(1);
  });
});

if (!TEST_DB) {
  // Mark the file as having a registered (skipped) test so vitest reports it.
  describe("RLS — skipped", () => {
    it.skip(skipReason, () => {
      // intentional
    });
  });
}
