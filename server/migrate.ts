import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { sql } from "drizzle-orm";
import path from "node:path";
import url from "node:url";
import { logger } from "./lib/logger";

// Build database URL from environment variables
function getDatabaseUrl(): string {
  if (process.env.PGHOST && process.env.PGUSER && process.env.PGPASSWORD && process.env.PGDATABASE) {
    const host = process.env.PGHOST;
    const user = process.env.PGUSER;
    const password = process.env.PGPASSWORD;
    const database = process.env.PGDATABASE;
    const port = process.env.PGPORT || "5432";
    return `postgresql://${user}:${password}@${host}:${port}/${database}`;
  }

  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  throw new Error("Database connection not configured. Please ensure PostgreSQL is provisioned.");
}

// Resolve the migrations folder relative to this source file so the same code path
// works in `tsx` dev (./migrations/ relative to repo root) and in the esbuild-bundled
// Vercel handler (api/index.mjs), which resolves ./migrations/ relative to cwd.
function resolveMigrationsFolder(): string {
  // In tsx / node with native ESM: use import.meta.url.
  // In esbuild-bundled output, `import.meta.url` is preserved and points at the bundle.
  // Walk up until we find a sibling `migrations/` directory with `_journal.json`.
  try {
    const here = url.fileURLToPath(import.meta.url);
    let dir = path.dirname(here);
    for (let i = 0; i < 6; i += 1) {
      const candidate = path.join(dir, "migrations", "meta", "_journal.json");
      try {
        // Use require.resolve-style probe.
        const fs = require("node:fs");
        if (fs.existsSync(candidate)) {
          return path.join(dir, "migrations");
        }
      } catch {
        // fall through
      }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  } catch {
    // import.meta.url may not be available — fall through to cwd-relative.
  }
  return path.resolve(process.cwd(), "migrations");
}

// Legacy-DB bridge: a DB that was created by the pre-drizzle-kit runtime loop already
// has the full schema but no __drizzle_migrations rows. Running drizzle-orm's migrator
// against it would error on CREATE TABLE collisions in 0000/0001. Detect that case and
// stamp the migration ledger with 0000 + 0001 as already applied, so the migrator only
// runs 0002 (which is idempotent). New DBs are unaffected — they have neither the
// schema nor any migration rows, so the migrator runs 0000 → 0001 → 0002 in order.
async function stampPreExistingMigrations(pool: Pool): Promise<void> {
  // Drizzle's bookkeeping table lives in its own schema.
  await pool.query(`CREATE SCHEMA IF NOT EXISTS drizzle`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `);

  const { rows: countRows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM drizzle.__drizzle_migrations`,
  );
  const existingRows = Number(countRows[0]?.count ?? "0");

  // Probe: does the DB look like it was populated by the old runtime loop? The
  // audit_events table didn't exist in 0000; if it's already here, we're migrating
  // a live DB that skipped drizzle-kit.
  const { rows: probeRows } = await pool.query<{ to_regclass: string | null }>(
    `SELECT to_regclass('public.audit_events')::text AS to_regclass`,
  );
  const hasAuditEvents = Boolean(probeRows[0]?.to_regclass);

  if (existingRows === 0 && hasAuditEvents) {
    // Back-fill any 0001 tables the old runtime loop missed. Stamping 0001 as applied
    // skips its CREATE statements, so a table that existed only in schema.ts (not in
    // the old loop's hardcoded list) would silently never get created. This closes
    // that gap for the specific tables known to have been added late to the runtime
    // loop. Idempotent — CREATE IF NOT EXISTS is a no-op when the table is present.
    await pool.query(
      `CREATE TABLE IF NOT EXISTS "rateLimit" (
         "key" text PRIMARY KEY NOT NULL,
         "count" integer NOT NULL,
         "last_request" bigint NOT NULL
       )`,
    );

    // Stamp 0000 + 0001 as already applied. Hashes aren't verified at runtime;
    // drizzle only compares by index order in _journal.json, so tag-derived hashes
    // are fine. The migrator will then run only unreached entries (0002+).
    const now = Date.now();
    await pool.query(
      `INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
       VALUES ($1, $2), ($3, $4)`,
      [
        "0000_happy_thunderball",
        now - 1000,
        "0001_consolidate_from_runtime",
        now,
      ],
    );
    logger.info(
      "Detected pre-existing schema. Back-filled rateLimit if missing; stamped 0000 + 0001 as applied; migrator will resume from 0002.",
    );
  }
}

export async function runMigrations(): Promise<boolean> {
  const dbUrl = getDatabaseUrl();
  const connString = !dbUrl.includes("sslmode=")
    ? dbUrl + (dbUrl.includes("?") ? "&" : "?") + "sslmode=require"
    : dbUrl;
  const pool = new Pool({ connectionString: connString });

  try {
    logger.info("Running database migrations");

    await stampPreExistingMigrations(pool);

    const db = drizzle(pool);
    const migrationsFolder = resolveMigrationsFolder();
    await migrate(db, { migrationsFolder });

    logger.info("Database migrations completed successfully");
    return true;
  } catch (error) {
    logger.error({ err: error }, "Error running migrations");
    return false;
  } finally {
    await pool.end();
  }
}

// Re-export `sql` so callers that previously only imported from this file can still
// pull the drizzle helper — preserves backward compatibility with any downstream imports.
export { sql };
