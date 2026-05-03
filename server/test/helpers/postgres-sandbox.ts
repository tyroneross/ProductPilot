/**
 * Native-Postgres RLS sandbox.
 *
 * Why this exists:
 *   The RLS integration test in server/test/rls-spec-artifacts.test.ts must
 *   execute against a real Postgres to verify that the policies in
 *   migrations/0002 + 0003 actually block cross-tenant SELECT/INSERT. The
 *   prior pattern relied on a CI-only TEST_DATABASE_URL that was never wired,
 *   so the contract was unverified outside manual SQL trace.
 *
 * What it does:
 *   1. Connects to the developer's local `postgresql@15` Homebrew service via
 *      a bootstrap URL (default: `postgresql://localhost:5432/postgres` with
 *      the current OS user; `LOCAL_PG_URL` overrides for non-default setups).
 *   2. Creates a uniquely-named ephemeral DB
 *      (`productpilot_rls_<pid>_<ts>_<rand>`) so parallel test workers can't
 *      collide.
 *   3. Applies migrations/0000 → 0003 in lexical order by splitting each file
 *      on the `--> statement-breakpoint` separator drizzle-kit emits.
 *   4. Asserts RLS is enabled on `projects`, `intake_questions`, and
 *      `spec_artifacts` via `pg_class.relrowsecurity`.
 *   5. Creates a non-superuser role `productpilot_rls_app` and grants it
 *      table-level privileges. The actual RLS test queries `SET LOCAL ROLE`
 *      to that role, since Postgres lets superusers bypass RLS even with
 *      `FORCE ROW LEVEL SECURITY` (FORCE only affects the table owner). Without
 *      switching roles, the cross-tenant tests would never see RLS at all.
 *   6. Drops the database (and the role if no other DB still uses it) on
 *      teardown. Connection strings stay in memory; never logged or persisted.
 *
 * Gating:
 *   This helper only runs when `RLS_SANDBOX=1` (set by the `test:rls`
 *   package.json script). Default `npm run test` is unaffected — the RLS test
 *   skips itself when neither `RLS_SANDBOX` nor `TEST_DATABASE_URL` is set.
 *
 * Security gates:
 *   - Sandbox DB is ephemeral and dropped on teardown (or on next `test:rls`
 *     run if a previous run crashed mid-flight: see `cleanupOrphanedSandboxes`).
 *   - No prod data ever touches the sandbox; the helper builds its connection
 *     string from `LOCAL_PG_URL` or defaults to localhost:5432, never reads
 *     `.env.local` / `DATABASE_URL` / `POSTGRES_URL`.
 *   - The DB name embeds `<pid>_<timestamp>_<rand>` to prevent collision.
 *   - Connection strings are never written to disk or logged at info level.
 *   - `productpilot_rls_app` is `NOLOGIN`, so even if the role survives a
 *     crashed teardown, no external user can connect as it.
 */

import { Client } from "pg";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

export interface SandboxHandle {
  /** Connection string the test should use for its rls-bound client. */
  connectionString: string;
  /** Bootstrap URL pointing at `postgres` DB (used for DROP DATABASE on teardown). */
  bootstrapUrl: string;
  /** Generated database name. */
  dbName: string;
  /** Non-superuser role name granted table-level privileges. */
  appRole: string;
}

const ROLE_NAME = "productpilot_rls_app";
const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..", "..");

/**
 * Build the bootstrap connection URL. Local Homebrew Postgres typically
 * accepts the current OS user with no password. The user can override via
 * `LOCAL_PG_URL` for non-default setups (custom port, password, remote, etc.).
 */
function bootstrapUrl(): string {
  if (process.env.LOCAL_PG_URL && process.env.LOCAL_PG_URL.length > 0) {
    return process.env.LOCAL_PG_URL;
  }
  const user = process.env.USER ?? process.env.LOGNAME ?? "postgres";
  return `postgresql://${user}@localhost:5432/postgres`;
}

/** Generate a unique sandbox DB name. */
function generateDbName(): string {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `productpilot_rls_${process.pid}_${ts}_${rand}`;
}

/**
 * Drizzle-kit emits `--> statement-breakpoint` between top-level statements.
 * Split on it, but keep `DO $$ ... END $$;` blocks intact (the breakpoint
 * appears between blocks, never inside them).
 */
function splitStatements(sql: string): string[] {
  return sql
    .split(/-->\s*statement-breakpoint/gi)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

async function applyMigrationFile(client: Client, filePath: string): Promise<void> {
  const sql = await readFile(filePath, "utf-8");
  const statements = splitStatements(sql);
  for (const stmt of statements) {
    // Strip the trailing semicolon if present; pg client handles either way.
    await client.query(stmt);
  }
}

async function applyAllMigrations(client: Client): Promise<string[]> {
  const dir = path.join(REPO_ROOT, "migrations");
  const all = await readdir(dir);
  const sqlFiles = all
    .filter((f) => /^\d{4}_.*\.sql$/.test(f))
    .sort(); // lexical sort puts 0000 → 0001 → 0002 → 0003 in order
  for (const f of sqlFiles) {
    await applyMigrationFile(client, path.join(dir, f));
  }
  return sqlFiles;
}

async function assertRlsEnabled(client: Client, tables: string[]): Promise<Record<string, boolean>> {
  const results: Record<string, boolean> = {};
  for (const tbl of tables) {
    const { rows } = await client.query<{ relrowsecurity: boolean }>(
      `SELECT relrowsecurity FROM pg_class WHERE relname = $1 AND relnamespace = 'public'::regnamespace`,
      [tbl],
    );
    if (rows.length === 0) {
      throw new Error(`RLS sandbox: expected table public.${tbl} to exist after migrations, none found`);
    }
    results[tbl] = rows[0].relrowsecurity;
    if (!rows[0].relrowsecurity) {
      throw new Error(`RLS sandbox: table public.${tbl} has RLS disabled — migration regression`);
    }
  }
  return results;
}

async function createAppRole(client: Client): Promise<void> {
  // CREATE ROLE is not transactional with IF NOT EXISTS; emulate idempotence.
  // Role is per-cluster, not per-DB, so a prior crashed run may have left it.
  const { rows } = await client.query<{ rolname: string }>(
    `SELECT rolname FROM pg_roles WHERE rolname = $1`,
    [ROLE_NAME],
  );
  if (rows.length === 0) {
    // NOLOGIN: this role can never be authenticated as. SET ROLE works because
    // the superuser session can switch into any role regardless of LOGIN.
    await client.query(`CREATE ROLE ${ROLE_NAME} NOLOGIN NOSUPERUSER NOBYPASSRLS`);
  }
  await client.query(`GRANT USAGE ON SCHEMA public TO ${ROLE_NAME}`);
  await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${ROLE_NAME}`);
  await client.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${ROLE_NAME}`);
  // Default privileges for any future tables created in this DB.
  await client.query(
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${ROLE_NAME}`,
  );
}

/**
 * On a clean exit (or on graceful teardown after test failure), this drops
 * the sandbox DB. If a previous run crashed and left an orphan, the next
 * setup invocation can call `cleanupOrphanedSandboxes` to sweep them.
 */
export async function cleanupOrphanedSandboxes(maxAgeMinutes = 60): Promise<number> {
  const url = bootstrapUrl();
  const admin = new Client({ connectionString: url });
  await admin.connect();
  try {
    const cutoff = Date.now() - maxAgeMinutes * 60_000;
    const { rows } = await admin.query<{ datname: string }>(
      `SELECT datname FROM pg_database WHERE datname LIKE 'productpilot_rls_%'`,
    );
    let dropped = 0;
    for (const { datname } of rows) {
      // Name format: productpilot_rls_<pid>_<ts>_<rand>
      const match = /^productpilot_rls_\d+_(\d+)_/.exec(datname);
      if (!match) continue;
      const ts = Number(match[1]);
      if (ts < cutoff) {
        try {
          // Force-disconnect and drop. May fail if the orphan owner is alive — best-effort.
          await admin.query(
            `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
            [datname],
          );
          await admin.query(`DROP DATABASE IF EXISTS "${datname}"`);
          dropped += 1;
        } catch {
          // Swallow: orphan might be in use by another live test run.
        }
      }
    }
    return dropped;
  } finally {
    await admin.end();
  }
}

export async function setupSandboxDb(): Promise<SandboxHandle> {
  const url = bootstrapUrl();
  const dbName = generateDbName();

  // 1. Sweep stale orphans from prior crashed runs (>60 min old).
  await cleanupOrphanedSandboxes().catch(() => {
    /* non-fatal */
  });

  // 2. Create the fresh DB on the bootstrap connection.
  const admin = new Client({ connectionString: url });
  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE "${dbName}"`);
  } finally {
    await admin.end();
  }

  // 3. Connect to the new DB and apply migrations.
  const sandboxConnString = url.replace(/\/postgres(\?|$)/, `/${dbName}$1`);
  // Edge case: bootstrap URL didn't end in /postgres → fall back to URL parse.
  const sandboxUrl =
    sandboxConnString === url
      ? (() => {
          const parsed = new URL(url);
          parsed.pathname = `/${dbName}`;
          return parsed.toString();
        })()
      : sandboxConnString;

  const client = new Client({ connectionString: sandboxUrl });
  await client.connect();
  try {
    await applyAllMigrations(client);
    await assertRlsEnabled(client, ["projects", "intake_questions", "spec_artifacts"]);
    await createAppRole(client);
  } catch (err) {
    await client.end().catch(() => {});
    // Best-effort cleanup if migrations failed mid-flight.
    const cleanup = new Client({ connectionString: url });
    await cleanup.connect().catch(() => {});
    await cleanup
      .query(`DROP DATABASE IF EXISTS "${dbName}"`)
      .catch(() => {});
    await cleanup.end().catch(() => {});
    throw err;
  }
  await client.end();

  return {
    connectionString: sandboxUrl,
    bootstrapUrl: url,
    dbName,
    appRole: ROLE_NAME,
  };
}

export async function teardownSandboxDb(handle: SandboxHandle): Promise<void> {
  const admin = new Client({ connectionString: handle.bootstrapUrl });
  await admin.connect();
  try {
    // Force-disconnect any lingering sessions on the sandbox DB.
    await admin.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [handle.dbName],
    );
    await admin.query(`DROP DATABASE IF EXISTS "${handle.dbName}"`);
  } finally {
    await admin.end();
  }
}
