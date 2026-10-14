// The dashboard never migrates. On a missing or unmigrated database it must
// answer with one clear 503 that says how to fix it, not "500 Internal Error".
import Database from 'better-sqlite3';
import { mkdtempSync, rmSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

let dir: string;

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), 'agentscrum-hooks-'));
	vi.resetModules();
	delete process.env.AGENTSCRUM_DB_PATH;
});

afterEach(() => {
	rmSync(dir, { recursive: true, force: true });
	delete process.env.SCRUM_DB_PATH;
});

async function request(pathname: string) {
	const { handle } = await import('./hooks.server');
	const resolve = vi.fn(async () => new Response('page', { status: 200 }));
	const event = { url: new URL(`http://localhost${pathname}`) } as Parameters<typeof handle>[0]['event'];
	const response = await handle({ event, resolve } as unknown as Parameters<typeof handle>[0]);
	return { response, resolve };
}

describe('dashboard database check', () => {
	test('an unmigrated database gets a 503 that says to run db:migrate', async () => {
		const db = join(dir, 'unmigrated.db');
		const sqlite = new Database(db);
		sqlite.pragma('journal_mode = WAL');
		sqlite.close();
		process.env.SCRUM_DB_PATH = db;

		const { response, resolve } = await request('/');
		expect(response.status).toBe(503);
		const text = await response.text();
		expect(text).toContain('database has no migrations applied');
		expect(text).toContain('npm run db:migrate');
		expect(resolve).not.toHaveBeenCalled();
	});

	test('a database missing the newest migration gets a 503 naming it', async () => {
		const db = join(dir, 'old.db');
		const sqlite = new Database(db);
		sqlite.exec('CREATE TABLE __drizzle_migrations (id INTEGER PRIMARY KEY, hash text NOT NULL, created_at numeric)');
		sqlite.prepare('INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)').run('x', 1);
		sqlite.close();
		process.env.SCRUM_DB_PATH = db;

		const { response } = await request('/');
		expect(response.status).toBe(503);
		expect(await response.text()).toMatch(/migration\(s\) not applied: 0000_/);
	});

	test('a missing database gets a 503 and is not created', async () => {
		const db = join(dir, 'missing.db');
		process.env.SCRUM_DB_PATH = db;

		const { response } = await request('/api/sprint');
		expect(response.status).toBe(503);
		expect(await response.text()).toContain('database not found');
		expect(existsSync(db)).toBe(false);
	});

	test('/healthz is passed through so it can report the problem itself', async () => {
		process.env.SCRUM_DB_PATH = join(dir, 'missing.db');
		const { response, resolve } = await request('/healthz');
		expect(resolve).toHaveBeenCalled();
		expect(response.status).toBe(200);
	});
});
