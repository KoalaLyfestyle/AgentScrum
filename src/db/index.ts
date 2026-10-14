import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "path";
import * as schema from "./schema.js";
import { getProjectRoot, resolveDbPath } from "./path.js";
import { openSqlite } from "./open.js";
import { getMigrationStatus, type MigrationStatus } from "./migrations.js";
import fs from "fs";

/**
 * Resolved database path. Read lazily so a host process (the dashboard) can set
 * SCRUM_DB_PATH before the first query. See src/db/path.ts for the rules.
 */
export function getDbPath(): string {
  return resolveDbPath();
}

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let migrateOnOpen: boolean | null = null;

/** Env setting: SCRUM_MIGRATE_ON_OPEN=0 turns off migrate-on-open (the container sets it). */
export const MIGRATE_ON_OPEN_ENV = "SCRUM_MIGRATE_ON_OPEN";

/**
 * Whether getDb() applies pending migrations when it first opens the database.
 * The dashboard turns this off so viewing a database never changes its schema.
 * Call before the first getDb(). Overrides SCRUM_MIGRATE_ON_OPEN.
 */
export function setMigrateOnOpen(enabled: boolean): void {
  migrateOnOpen = enabled;
}

/** The effective setting: setMigrateOnOpen(), else SCRUM_MIGRATE_ON_OPEN, else on. */
export function shouldMigrateOnOpen(): boolean {
  if (migrateOnOpen !== null) return migrateOnOpen;
  const value = process.env[MIGRATE_ON_OPEN_ENV];
  return !(value !== undefined && ["0", "false", "no", "off"].includes(value.trim().toLowerCase()));
}

export function getDb(): ReturnType<typeof drizzle<typeof schema>> {
  if (_db) return _db;

  const dbPath = getDbPath();
  if (!shouldMigrateOnOpen()) {
    // Not migrating here, so never create an empty file or run on an old schema.
    const status = checkSchema(dbPath);
    if (!status.ok) {
      throw new Error(
        `${status.reason}. Migrations are off here (${MIGRATE_ON_OPEN_ENV}=0 or the dashboard). ` +
          `Run the migrate step first: docker compose up -d, or npm run db:migrate.`
      );
    }
  }
  const sqlite = openSqlite(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  _db = drizzle(sqlite, { schema });
  if (shouldMigrateOnOpen()) {
    migrate(_db, { migrationsFolder: getMigrationsFolder() });
  }
  return _db;
}

/** The drizzle/ folder getDb() migrates from. */
export function getMigrationsFolder(): string {
  return path.resolve(getProjectRoot(), "drizzle");
}

/**
 * Read-only schema check for processes that do not migrate (the dashboard,
 * and the MCP server in the container). Never creates or changes the file.
 */
export function checkSchema(dbPath: string = getDbPath()): MigrationStatus {
  if (dbPath !== ":memory:" && !fs.existsSync(dbPath)) {
    return { ok: false, expected: 0, pending: [], reason: `database not found at ${dbPath}` };
  }
  const sqlite = openSqlite(dbPath, { readonly: true, fileMustExist: dbPath !== ":memory:" });
  try {
    return getMigrationStatus(sqlite, getMigrationsFolder());
  } finally {
    sqlite.close();
  }
}

/** Reset the DB singleton. Only used in tests. */
export function _resetDb(): void {
  _db = null;
}

// Re-exported so the dashboard builds queries with the same drizzle-orm copy
// that owns the schema objects (one drizzle version in the process).
export { inArray, eq, and, desc, asc, sql } from "drizzle-orm";

export { schema };
