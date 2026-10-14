import fs from "fs";
import path from "path";
import type Database from "better-sqlite3";

/** Table drizzle-orm's SQLite migrator records applied migrations in. */
export const MIGRATIONS_TABLE = "__drizzle_migrations";

export interface MigrationStatus {
  /** True when every migration in the folder has been applied. */
  ok: boolean;
  /** Number of migrations in drizzle/meta/_journal.json. */
  expected: number;
  /** Migration tags not yet applied, oldest first. */
  pending: string[];
  /** Short reason when ok is false. */
  reason?: string;
}

interface JournalEntry {
  tag: string;
  when: number;
}

/**
 * Compare a database with the migrations folder, using the same rule as the
 * drizzle-orm migrator: a migration is applied when its journal `when` is not
 * newer than the latest `created_at` in __drizzle_migrations.
 * Read-only: never creates tables or changes the database.
 */
export function getMigrationStatus(
  sqlite: Database.Database,
  migrationsFolder: string
): MigrationStatus {
  const journalPath = path.join(migrationsFolder, "meta", "_journal.json");
  const journal = JSON.parse(fs.readFileSync(journalPath, "utf8")) as { entries: JournalEntry[] };
  const entries = journal.entries;

  const table = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(MIGRATIONS_TABLE);
  if (!table) {
    return {
      ok: entries.length === 0,
      expected: entries.length,
      pending: entries.map((e) => e.tag),
      reason: entries.length === 0 ? undefined : "database has no migrations applied",
    };
  }
  const row = sqlite
    .prepare(`SELECT MAX(CAST(created_at AS INTEGER)) AS last FROM ${MIGRATIONS_TABLE}`)
    .get() as { last: number | null };
  const last = row.last ?? -Infinity;
  const pending = entries.filter((e) => e.when > last).map((e) => e.tag);
  return {
    ok: pending.length === 0,
    expected: entries.length,
    pending,
    reason: pending.length === 0 ? undefined : `${pending.length} migration(s) not applied: ${pending.join(", ")}`,
  };
}
