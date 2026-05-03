/**
 * Migration journal guard — unit test.
 *
 * Why this exists:
 *   `server/lib/migrate-guard.ts` runs at startup and throws if a `.sql`
 *   migration is missing from `_journal.json`. The bug it prevents is real
 *   (commit bc7a17d shipped 0003_adaptive_intake.sql without journaling it,
 *   which would have skipped 4 schema changes in prod). This test fixtures
 *   both the failing and passing case so the guard can't regress silently.
 *
 * Strategy:
 *   Build a temp directory that mirrors the on-disk migrations layout:
 *     tmp/
 *       0000_a.sql
 *       0001_b.sql
 *       meta/_journal.json
 *   Toggle whether 0001 is in the journal to exercise both paths.
 *
 * No DB, no network — purely filesystem.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  assertJournalCoversAllMigrations,
  scanMigrationJournal,
} from "../lib/migrate-guard";

interface JournalShape {
  version: string;
  dialect: string;
  entries: Array<{
    idx: number;
    version: string;
    when: number;
    tag: string;
    breakpoints: boolean;
  }>;
}

function makeJournal(tags: string[]): JournalShape {
  return {
    version: "7",
    dialect: "postgresql",
    entries: tags.map((tag, idx) => ({
      idx,
      version: "7",
      when: 1_700_000_000_000 + idx * 1000,
      tag,
      breakpoints: true,
    })),
  };
}

describe("migrate journal guard", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(path.join(tmpdir(), "pp-migrate-guard-"));
    mkdirSync(path.join(tmp, "meta"), { recursive: true });
    // Two SQL files on disk.
    writeFileSync(path.join(tmp, "0000_a.sql"), "-- noop\n");
    writeFileSync(path.join(tmp, "0001_b.sql"), "-- noop\n");
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("throws when a .sql file is missing from _journal.json", () => {
    // Journal lists only 0000 — 0001 is unjournaled.
    writeFileSync(
      path.join(tmp, "meta", "_journal.json"),
      JSON.stringify(makeJournal(["0000_a"]), null, 2),
    );

    expect(() => assertJournalCoversAllMigrations(tmp)).toThrowError(
      /Migration journal drift.*0001_b\.sql.*0001_b/s,
    );
  });

  it("passes silently when every .sql file has a journal entry", () => {
    writeFileSync(
      path.join(tmp, "meta", "_journal.json"),
      JSON.stringify(makeJournal(["0000_a", "0001_b"]), null, 2),
    );

    expect(() => assertJournalCoversAllMigrations(tmp)).not.toThrow();
  });

  it("scanMigrationJournal returns both lists", () => {
    writeFileSync(
      path.join(tmp, "meta", "_journal.json"),
      JSON.stringify(makeJournal(["0000_a"]), null, 2),
    );

    const result = scanMigrationJournal(tmp);
    expect(result.journaled).toEqual(["0000_a.sql"]);
    expect(result.unjournaled).toEqual([
      { file: "0001_b.sql", expectedTag: "0001_b" },
    ]);
  });

  it("ignores non-migration files in the directory", () => {
    // README and other artifacts should not trip the guard.
    writeFileSync(path.join(tmp, "README.md"), "# notes\n");
    writeFileSync(path.join(tmp, "scratch.txt"), "unrelated\n");
    writeFileSync(
      path.join(tmp, "meta", "_journal.json"),
      JSON.stringify(makeJournal(["0000_a", "0001_b"]), null, 2),
    );

    expect(() => assertJournalCoversAllMigrations(tmp)).not.toThrow();
  });

  it("error message lists every unjournaled file", () => {
    // Add a third unjournaled file to confirm the message enumerates all of them.
    writeFileSync(path.join(tmp, "0002_c.sql"), "-- noop\n");
    writeFileSync(
      path.join(tmp, "meta", "_journal.json"),
      JSON.stringify(makeJournal(["0000_a"]), null, 2),
    );

    let caught: Error | undefined;
    try {
      assertJournalCoversAllMigrations(tmp);
    } catch (err) {
      caught = err as Error;
    }
    expect(caught).toBeDefined();
    expect(caught!.message).toContain("0001_b.sql");
    expect(caught!.message).toContain("0002_c.sql");
    // The message must NOT echo any environment variables or paths beyond the
    // migrations folder itself (security gate).
    expect(caught!.message).not.toMatch(/postgres:\/\//);
    expect(caught!.message).not.toMatch(/PG[A-Z]+=/);
  });
});
