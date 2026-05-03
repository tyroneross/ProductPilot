/**
 * RLS contract tests for `intake_questions` and `spec_artifacts`.
 *
 * Verifies the policies created by migrations/0003_adaptive_intake.sql against
 * a real Postgres. Two run modes:
 *
 *   1. RLS_SANDBOX=1 (preferred, used by `npm run test:rls`) — an ephemeral
 *      Postgres database is created by globalSetup, all migrations applied,
 *      RLS verified enabled. Connection string lives in
 *      `process.env.RLS_SANDBOX_URL`.
 *
 *   2. TEST_DATABASE_URL=<url> — a developer-provided DB. Mirrors legacy
 *      behavior. Skipped silently when neither env var is set.
 *
 * The default `npm run test` path sets neither env var, so all tests in this
 * file skip cleanly. CI/dev opts in via `npm run test:rls`.
 *
 * Why we SET ROLE inside each contract test:
 *   The vitest worker connects as the local Homebrew superuser. Postgres lets
 *   superusers bypass RLS entirely, even with `FORCE ROW LEVEL SECURITY`
 *   (FORCE only affects table OWNER, not superusers). To actually exercise
 *   the policy, we `SET LOCAL ROLE productpilot_rls_app` (a NOLOGIN, NOSUPERUSER,
 *   NOBYPASSRLS role created by the sandbox helper) for every assertion that
 *   needs RLS to apply. Fixture seeding stays superuser, so we can plant
 *   tenant-A's data without first authenticating as tenant A.
 *
 * Contracts covered (8 tests):
 *   - Cross-tenant SELECT returns 0 rows (intake_questions, spec_artifacts).
 *   - Cross-tenant INSERT raises (intake_questions, spec_artifacts).
 *   - Same-tenant SELECT works (intake_questions, spec_artifacts).
 *   - Same-tenant INSERT works (intake_questions).
 *   - Guest-owner path: guest can read its own project's spec_artifacts.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "pg";

const SANDBOX_URL = process.env.RLS_SANDBOX_URL;
const LEGACY_TEST_DB = process.env.TEST_DATABASE_URL;
const APP_ROLE = process.env.RLS_SANDBOX_APP_ROLE ?? "productpilot_rls_app";
const TEST_DB = SANDBOX_URL ?? LEGACY_TEST_DB;

const skipReason =
  "RLS_SANDBOX=1 not set (run `npm run test:rls` for live RLS contracts) and no TEST_DATABASE_URL fallback.";

describe.skipIf(!TEST_DB)("RLS — cross-tenant isolation on adaptive-intake tables", () => {
  let client: Client;

  // Each test run uses unique tenant identifiers so re-runs don't collide on
  // any shared TEST_DATABASE_URL setup. Sandbox runs are already isolated.
  const stamp = Date.now() + "-" + Math.random().toString(36).slice(2, 7);
  const tenantA = `rls-test-tenant-a-${stamp}`;
  const tenantB = `rls-test-tenant-b-${stamp}`;
  const guestA = `rls-test-guest-a-${stamp}`;
  const guestB = `rls-test-guest-b-${stamp}`;

  let projectAId: string;
  let projectGuestAId: string;
  let intakeQuestionAId: string;

  /** Run a block with `SET LOCAL ROLE` so RLS actually fires. */
  async function withAppRole<T>(fn: () => Promise<T>): Promise<T> {
    await client.query("BEGIN");
    try {
      await client.query(`SET LOCAL ROLE ${APP_ROLE}`);
      const out = await fn();
      await client.query("COMMIT");
      return out;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }
  }

  /** Set the per-request GUCs the storage-hybrid layer sets in production. */
  async function setActor(opts: { userId?: string; guestOwnerId?: string }): Promise<void> {
    await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [opts.userId ?? ""]);
    await client.query(`SELECT set_config('app.current_guest_owner_id', $1, true)`, [opts.guestOwnerId ?? ""]);
  }

  beforeAll(async () => {
    if (!TEST_DB) return;
    client = new Client({ connectionString: TEST_DB });
    await client.connect();

    // Seed fixtures as superuser. Inserting projects under both tenant A
    // (user-owned) and a guest-owned project covers both policy branches
    // (current_user_id vs current_guest_owner_id).
    //
    // projects.user_id has a FK → user.id (cross-schema, added by migration
    // 0002). Plant minimal user rows so the FK holds. Tenant B has no project
    // rows but still gets a user row so any future negative-INSERT contracts
    // don't trip on the FK before they trip on the policy.
    for (const id of [tenantA, tenantB]) {
      await client.query(
        `INSERT INTO "user" (id, name, email, email_verified) VALUES ($1, $2, $3, $4)`,
        [id, `rls fixture ${id}`, `${id}@rls.test`, true],
      );
    }

    const projA = await client.query(
      `INSERT INTO projects (user_id, name, description) VALUES ($1, $2, $3) RETURNING id`,
      [tenantA, "rls test project A", "rls fixture user-owned"],
    );
    projectAId = projA.rows[0].id;

    const projGuest = await client.query(
      `INSERT INTO projects (guest_owner_id, name, description) VALUES ($1, $2, $3) RETURNING id`,
      [guestA, "rls test project guest", "rls fixture guest-owned"],
    );
    projectGuestAId = projGuest.rows[0].id;

    await client.query(
      `INSERT INTO spec_artifacts (project_id, kind, payload) VALUES ($1, $2, $3)`,
      [projectAId, "brief", { test: true, owner: "tenantA" }],
    );
    await client.query(
      `INSERT INTO spec_artifacts (project_id, kind, payload) VALUES ($1, $2, $3)`,
      [projectGuestAId, "brief", { test: true, owner: "guestA" }],
    );

    const iq = await client.query(
      `INSERT INTO intake_questions (project_id, step, question_text, answer_text)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [projectAId, 1, "What pain point are you solving?", "rls fixture answer"],
    );
    intakeQuestionAId = iq.rows[0].id;
  });

  afterAll(async () => {
    if (!TEST_DB || !client) return;
    // Cleanup as superuser (RLS bypassed). Project rows cascade-delete their
    // intake_questions + spec_artifacts. The user rows go after, since
    // projects.user_id → user.id is ON DELETE SET NULL (deleting the user
    // first would simply NULL the project FK, but cleaning projects first
    // keeps the order obvious).
    if (projectAId) {
      await client.query(`DELETE FROM projects WHERE id = $1`, [projectAId]);
    }
    if (projectGuestAId) {
      await client.query(`DELETE FROM projects WHERE id = $1`, [projectGuestAId]);
    }
    await client.query(`DELETE FROM "user" WHERE id = ANY($1)`, [[tenantA, tenantB]]);
    await client.end();
  });

  it("blocks tenant B from SELECT on tenant A's spec_artifacts", async () => {
    await withAppRole(async () => {
      await setActor({ userId: tenantB });
      const res = await client.query(`SELECT * FROM spec_artifacts WHERE project_id = $1`, [projectAId]);
      expect(res.rows).toHaveLength(0);
    });
  });

  it("blocks tenant B from SELECT on tenant A's intake_questions", async () => {
    await withAppRole(async () => {
      await setActor({ userId: tenantB });
      const res = await client.query(`SELECT * FROM intake_questions WHERE project_id = $1`, [projectAId]);
      expect(res.rows).toHaveLength(0);
    });
  });

  it("blocks tenant B from INSERT into tenant A's spec_artifacts (WITH CHECK)", async () => {
    // The policy is EXISTS-on-projects keyed off the actor GUCs. Tenant B's
    // INSERT into a project owned by tenant A must fail. The policy fires as
    // either a violation or, since the EXISTS subquery returns no rows, as a
    // row-level-security violation. Either way, no row lands.
    await withAppRole(async () => {
      await setActor({ userId: tenantB });
      let threw = false;
      try {
        await client.query(
          `INSERT INTO spec_artifacts (project_id, kind, payload) VALUES ($1, $2, $3)`,
          [projectAId, "brief", { malicious: true }],
        );
      } catch (err) {
        threw = true;
        // Postgres uses SQLSTATE 42501 for RLS WITH CHECK violations.
        expect(String((err as Error).message)).toMatch(/row-level security|policy/i);
      }
      expect(threw).toBe(true);
    });
  });

  it("blocks tenant B from INSERT into tenant A's intake_questions (WITH CHECK)", async () => {
    await withAppRole(async () => {
      await setActor({ userId: tenantB });
      let threw = false;
      try {
        await client.query(
          `INSERT INTO intake_questions (project_id, step, question_text) VALUES ($1, $2, $3)`,
          [projectAId, 99, "malicious cross-tenant question"],
        );
      } catch (err) {
        threw = true;
        expect(String((err as Error).message)).toMatch(/row-level security|policy/i);
      }
      expect(threw).toBe(true);
    });
  });

  it("allows tenant A to SELECT its own spec_artifacts", async () => {
    await withAppRole(async () => {
      await setActor({ userId: tenantA });
      const res = await client.query(`SELECT * FROM spec_artifacts WHERE project_id = $1`, [projectAId]);
      expect(res.rows.length).toBeGreaterThanOrEqual(1);
      expect(res.rows[0].payload).toMatchObject({ owner: "tenantA" });
    });
  });

  it("allows tenant A to SELECT its own intake_questions", async () => {
    await withAppRole(async () => {
      await setActor({ userId: tenantA });
      const res = await client.query(`SELECT id FROM intake_questions WHERE project_id = $1`, [projectAId]);
      expect(res.rows.length).toBeGreaterThanOrEqual(1);
      expect(res.rows.some((r: { id: string }) => r.id === intakeQuestionAId)).toBe(true);
    });
  });

  it("allows tenant A to INSERT a new intake_question on its own project", async () => {
    await withAppRole(async () => {
      await setActor({ userId: tenantA });
      const res = await client.query(
        `INSERT INTO intake_questions (project_id, step, question_text)
         VALUES ($1, $2, $3) RETURNING id`,
        [projectAId, 2, "follow-up question"],
      );
      expect(res.rows).toHaveLength(1);
      expect(typeof res.rows[0].id).toBe("string");
    });
  });

  it("allows guest A to SELECT its own spec_artifacts and blocks guest B", async () => {
    // Guest path: the policy permits when current_guest_owner_id matches
    // projects.guest_owner_id. Cover both same-guest and cross-guest in one test
    // to keep the suite tight while still asserting both branches.
    await withAppRole(async () => {
      await setActor({ guestOwnerId: guestA });
      const ownRes = await client.query(`SELECT * FROM spec_artifacts WHERE project_id = $1`, [projectGuestAId]);
      expect(ownRes.rows.length).toBeGreaterThanOrEqual(1);
      expect(ownRes.rows[0].payload).toMatchObject({ owner: "guestA" });
    });
    await withAppRole(async () => {
      await setActor({ guestOwnerId: guestB });
      const crossRes = await client.query(`SELECT * FROM spec_artifacts WHERE project_id = $1`, [projectGuestAId]);
      expect(crossRes.rows).toHaveLength(0);
    });
  });
});

if (!TEST_DB) {
  // Mark the file as having a registered (skipped) test so vitest reports it
  // distinctly. Default `npm run test` shows: "RLS — skipped" with one ↓.
  describe("RLS — skipped (run `npm run test:rls` to execute)", () => {
    it.skip(skipReason, () => {
      // intentional
    });
  });
}
