// Resolve the AgentScrum database once, at server start, with the same rules as
// the CLI and MCP server (src/db/path.ts). Relative paths resolve from the
// AgentScrum checkout, never from the dashboard's working directory.
import { existsSync } from 'fs';
import { setMigrateOnOpen } from '$scrum/db/index.js';
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

if (dbPath !== ':memory:' && !existsSync(dbPath)) {
	throw new Error(
		`AgentScrum database not found at ${dbPath}.\n` +
			`The dashboard does not create or migrate databases.\n` +
			`Fix: run "npm run db:migrate" (or "scrum init <name>") in the AgentScrum checkout, ` +
			`or set ${CANONICAL_DB_ENV} to the database the CLI/MCP server uses.`
	);
}

// Pin both names to the absolute path so every later reader agrees.
process.env[CANONICAL_DB_ENV] = dbPath;
process.env[ALIAS_DB_ENV] = dbPath;
