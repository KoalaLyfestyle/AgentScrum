import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '$scrum/db/schema.js';

const dbPath = process.env['AGENTSCRUM_DB_PATH'] ?? '../agentscrum.db';

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb(): ReturnType<typeof drizzle<typeof schema>> {
	if (_db) return _db;
	const sqlite = new Database(dbPath);
	sqlite.pragma('journal_mode = WAL');
	sqlite.pragma('foreign_keys = ON');
	_db = drizzle(sqlite, { schema });
	return _db;
}

export { schema };
