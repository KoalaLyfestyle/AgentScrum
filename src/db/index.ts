import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { fileURLToPath } from "url";
import path from "path";
import * as schema from "./schema.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Fallback resolves relative to this file (src/db/ → project root) so the DB
// lands in the right place even when SCRUM_DB_PATH is unset and CWD varies.
export const dbPath =
  process.env["SCRUM_DB_PATH"] ??
  path.resolve(__dirname, "../../agentscrum.db");
const migrationsFolder = path.resolve(__dirname, "../../drizzle");

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb(): ReturnType<typeof drizzle<typeof schema>> {
  if (_db) return _db;

  const sqlite = new Database(dbPath);
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

export { schema };
