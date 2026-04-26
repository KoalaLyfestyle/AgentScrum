import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { fileURLToPath } from "url";
import path from "path";
import * as schema from "./schema.js";

// SCRUM_DB_PATH must be an absolute path. Claude Code launches MCP servers
// with CWD set to ~/Orion/, not the project root, so a relative path would
// silently open (or create) the wrong database file.
// The ./agentscrum.db fallback is safe only for local CLI runs where CWD IS the project root.
const dbPath = process.env["SCRUM_DB_PATH"] ?? "./agentscrum.db";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
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
