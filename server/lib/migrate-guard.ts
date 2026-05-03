/**
 * Migration journal guard.
 *
 * Why this exists:
 *   `server/migrate.ts` calls drizzle-orm's `migrate()`, which iterates
 *   `migrations/meta/_journal.json` — it does NOT scan the `migrations/`
 *   directory. A `.sql` file added without a journal entry is silently
 *   skipped in production. This actually happened with 0003_adaptive_intake
 *   (commit bc7a17d) and would have shipped to prod with the new tables
 *   missing.
 *
 * What this does:
 *   Enumerate every `NNNN_*.sql` file under `migrations/` and assert each
 *   has a corresponding `tag` entry in `_journal.json`. Throw with a clear
 *   message naming the unjournaled file. Cost: one directory listing on
 *   startup. Side-effect-free.
 *
 * Security:
 *   - Side-effect-free; no network, no DB calls.
 *   - Does not read or echo connection strings or env values.
 *   - Idempotent — pure function over filesystem state.
 */
import fs from "node:fs";
import path from "node:path";

interface JournalEntry {
  idx: number;
  version: string;
  when: number;
  tag: string;
  breakpoints?: boolean;
}

interface Journal {
  version: string;
  dialect: string;
  entries: JournalEntry[];
}

const SQL_FILE_PATTERN = /^(\d{4})_.*\.sql$/;

export interface UnjournaledFinding {
  /** Filename relative to migrations/, e.g. "0003_adaptive_intake.sql". */
  file: string;
  /** Tag drizzle would expect in `_journal.json` (filename minus `.sql`). */
  expectedTag: string;
}

export interface JournalScanResult {
  journaled: string[];
  unjournaled: UnjournaledFinding[];
}

/**
 * Inspect `<migrationsFolder>/meta/_journal.json` against `*.sql` files in
 * `<migrationsFolder>/`. Returns both lists; never throws.
 */
export function scanMigrationJournal(migrationsFolder: string): JournalScanResult {
  const journalPath = path.join(migrationsFolder, "meta", "_journal.json");
  const journalRaw = fs.readFileSync(journalPath, "utf-8");
  const journal = JSON.parse(journalRaw) as Journal;
  const journaledTags = new Set(journal.entries.map((e) => e.tag));

  const dirEntries = fs.readdirSync(migrationsFolder);
  const sqlFiles = dirEntries
    .filter((f) => SQL_FILE_PATTERN.test(f))
    .sort();

  const journaled: string[] = [];
  const unjournaled: UnjournaledFinding[] = [];
  for (const file of sqlFiles) {
    const tag = file.replace(/\.sql$/, "");
    if (journaledTags.has(tag)) {
      journaled.push(file);
    } else {
      unjournaled.push({ file, expectedTag: tag });
    }
  }
  return { journaled, unjournaled };
}

/**
 * Throw if any `*.sql` migration file is missing from `_journal.json`.
 * Called from `runMigrations()` before drizzle's migrator runs, so a
 * missing journal entry fails loud instead of being silently skipped.
 */
export function assertJournalCoversAllMigrations(migrationsFolder: string): void {
  const { unjournaled } = scanMigrationJournal(migrationsFolder);
  if (unjournaled.length === 0) return;

  const lines = unjournaled
    .map(
      (u) =>
        `  - ${u.file} → expected entry with tag "${u.expectedTag}" in migrations/meta/_journal.json`,
    )
    .join("\n");
  throw new Error(
    `Migration journal drift: ${unjournaled.length} SQL file(s) on disk are missing from _journal.json.\n` +
      `drizzle-orm's migrator iterates the journal, so these would be silently skipped at deploy.\n` +
      `Add a journal entry for each:\n${lines}`,
  );
}
