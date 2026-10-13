// Resolve the AgentScrum database once, at server start, with the same rules as
// the CLI and MCP server (src/db/path.ts). Relative paths resolve from the
// AgentScrum checkout, never from the dashboard's working directory.
import type { Handle } from '@sveltejs/kit';
import { checkSchema, setMigrateOnOpen } from '$scrum/db/index.js';
import {
	resolveDbPath,
	setProjectRoot,
	CANONICAL_DB_ENV,
	ALIAS_DB_ENV
} from '$scrum/db/path.js';

// Checkout root, baked in by vite.config.ts. In dev this equals PROJECT_ROOT;
// in a production build the bundled PROJECT_ROOT would point inside the build
// output, so the default DB and the migrations folder would be wrong.
declare const __AGENTSCRUM_ROOT__: string;

setProjectRoot(__AGENTSCRUM_ROOT__);
// Viewing a database must not change it: no migrations from the dashboard.
setMigrateOnOpen(false);
const dbPath = resolveDbPath();

// Pin both names to the absolute path so every later reader agrees.
process.env[CANONICAL_DB_ENV] = dbPath;
process.env[ALIAS_DB_ENV] = dbPath;

// Check the database before serving pages. A missing or unmigrated database
// gets one clear 503 message instead of "500 Internal Error" on every page.
// The server keeps running so /healthz can report the problem; once the check
// passes it is not repeated.
let schemaReady = false;

function schemaProblem(): string | null {
	if (schemaReady) return null;
	try {
		const status = checkSchema(dbPath);
		if (status.ok) {
			schemaReady = true;
			return null;
		}
		return status.reason ?? 'database is not ready';
	} catch (err) {
		return err instanceof Error ? err.message : String(err);
	}
}

const initialProblem = schemaProblem();
if (initialProblem) {
	process.stderr.write(`[agentscrum-dashboard] ${initialProblem} (${dbPath}). ${fixHint()}\n`);
}

function fixHint(): string {
	return (
		`The dashboard does not create or migrate databases. ` +
		`Fix: run "npm run db:migrate" in the AgentScrum checkout (or "docker compose up -d" for the container), ` +
		`or set ${CANONICAL_DB_ENV} to the database the CLI and MCP server use.`
	);
}

export const handle: Handle = async ({ event, resolve }) => {
	if (event.url.pathname !== '/healthz') {
		const problem = schemaProblem();
		if (problem) {
			return new Response(`AgentScrum database problem: ${problem}\nDatabase: ${dbPath}\n${fixHint()}\n`, {
				status: 503,
				headers: { 'content-type': 'text/plain; charset=utf-8' }
			});
		}
	}
	return resolve(event);
};
