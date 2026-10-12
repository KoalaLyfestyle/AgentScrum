import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "path";
import * as schema from "./schema.js";
import { PROJECT_ROOT, resolveDbPath } from "./path.js";
import { openSqlite } from "./open.js";

const migrationsFolder = path.resolve(PROJECT_ROOT, "drizzle");

/**
 * Resolved database path. Read lazily so a host process (the dashboard) can set
 * SCRUM_DB_PATH before the first query. See src/db/path.ts for the rules.
 */
export function getDbPath(): string {
  return resolveDbPath();
}

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb(): ReturnType<typeof drizzle<typeof schema>> {
  if (_db) return _db;

  const sqlite = openSqlite(getDbPath());
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  _db = drizzle(sqlite, { schema });
  migrate(_db, { migrationsFolder });
  return _db;
}

/** Reset the DB singleton. Only used in tests. */
export function _resetDb(): void {
  _db = null;
}

// Re-exported so the dashboard builds queries with the same drizzle-orm copy
// that owns the schema objects (one drizzle version in the process).
export { inArray, eq, and, desc, asc, sql } from "drizzle-orm";

export { schema };
