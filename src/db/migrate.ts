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

migrate(db, { migrationsFolder });
console.log(`Migrations applied to ${dbPath}`);
sqlite.close();
