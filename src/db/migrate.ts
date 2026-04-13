import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { fileURLToPath } from "url";
import path from "path";

const dbPath = process.env["SCRUM_DB_PATH"] ?? "./agentscrum.db";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(__dirname, "../../drizzle");

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
// FK enforcement is disabled during migration so table recreation migrations
// (required by SQLite's lack of ALTER COLUMN) can run without constraint errors.
// The application re-enables FK enforcement at runtime via db/index.ts.
sqlite.pragma("foreign_keys = OFF");

const db = drizzle(sqlite);

migrate(db, { migrationsFolder });
console.log(`Migrations applied to ${dbPath}`);
sqlite.close();
