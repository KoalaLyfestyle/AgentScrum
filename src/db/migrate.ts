import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { drizzle } from "drizzle-orm/better-sqlite3";
import path from "path";
import { PROJECT_ROOT, resolveDbPath } from "./path.js";
import { openSqlite } from "./open.js";

const dbPath = resolveDbPath();
const migrationsFolder = path.resolve(PROJECT_ROOT, "drizzle");

const sqlite = openSqlite(dbPath);
sqlite.pragma("journal_mode = WAL");
// FK enforcement is disabled during migration so table recreation migrations
// (required by SQLite's lack of ALTER COLUMN) can run without constraint errors.
// The application re-enables FK enforcement at runtime via db/index.ts.
sqlite.pragma("foreign_keys = OFF");

const db = drizzle(sqlite);

type RenumberRow = { id: number; table_name: string; row_id: number; scope_id: number; old_number: number; new_number: number };

function renumberedRows(afterId: number): RenumberRow[] {
  const exists = sqlite
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'renumber_log'")
    .get();
  if (!exists) return [];
  return sqlite
    .prepare("SELECT id, table_name, row_id, scope_id, old_number, new_number FROM renumber_log WHERE id > ? ORDER BY id")
    .all(afterId) as RenumberRow[];
}

const before = renumberedRows(0).reduce((max, r) => Math.max(max, r.id), 0);
migrate(db, { migrationsFolder });
console.log(`Migrations applied to ${dbPath}`);

// Migration 0014 renumbers duplicate epic, sprint, and issue numbers (#20).
// Say what it changed so the user can update any keys they wrote down.
const changed = renumberedRows(before);
if (changed.length > 0) {
  const scopeName: Record<string, string> = { epics: "project", sprints: "project", issues: "epic" };
  console.log(`Renumbered ${changed.length} duplicate number(s) (also stored in the renumber_log table):`);
  for (const r of changed) {
    console.log(
      `  ${r.table_name} id ${r.row_id} (${scopeName[r.table_name] ?? "scope"} ${r.scope_id}): ${r.old_number} -> ${r.new_number}`
    );
  }
}
sqlite.close();
