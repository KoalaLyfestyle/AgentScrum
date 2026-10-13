#!/usr/bin/env node
'use strict';
// Prints the Node runtime, checks that better-sqlite3 loads in it, and prints
// the database path the CLI and MCP server resolve, so you can compare them.
// Usage: npm run doctor            (uses the node on PATH)
//        /path/to/node scripts/doctor.cjs   (check the node an MCP client uses)
// Read-only: opens an in-memory database only. For agentscrum.db it only
// checks whether the file exists.
const { resolve } = require('path');
const fs = require('fs');

const root = resolve(__dirname, '..');
const wanted = fs.readFileSync(resolve(root, '.nvmrc'), 'utf8').trim();

console.log(`node path:    ${process.execPath}`);
console.log(`node version: ${process.version} (ABI ${process.versions.modules})`);
console.log(`platform:     ${process.platform}-${process.arch}`);
console.log(`expected:     v${wanted} (.nvmrc)`);

let ok = true;
if (process.versions.node.split('.')[0] !== wanted.split('.')[0]) {
  console.log(`WARN: Node major differs from .nvmrc`);
}
try {
  const Database = require(resolve(root, 'node_modules', 'better-sqlite3'));
  const db = new Database(':memory:');
  const v = db.prepare('select sqlite_version() as v').get().v;
  db.close();
  console.log(`better-sqlite3: OK (SQLite ${v})`);
} catch (err) {
  ok = false;
  console.log(`better-sqlite3: FAIL`);
  console.log(`  ${String(err && err.message).replace(/\s*\n\s*/g, ' ').trim()}`);
  console.log(`Fix: with this same node, run "npm rebuild better-sqlite3" in ${root}`);
}
// Database path, with the same rules as the CLI and MCP server (src/db/path.ts).
async function printDbPaths() {
  const pathModule = resolve(root, 'dist', 'db', 'path.js');
  if (!fs.existsSync(pathModule)) {
    console.log('database:     unknown (run "npm run build" first)');
    return;
  }
  const { pathToFileURL } = require('url');
  const { resolveDbPath } = await import(pathToFileURL(pathModule).href);
  const { cliEnv } = require(resolve(root, 'scripts', 'env-file.cjs'));
  const describe = (env) => {
    try {
      const p = resolveDbPath(env, root);
      const set = (name) => Boolean(env[name] && env[name].trim());
      const source = set('SCRUM_DB_PATH') ? 'SCRUM_DB_PATH' : set('AGENTSCRUM_DB_PATH') ? 'AGENTSCRUM_DB_PATH' : 'default';
      const state = p === ':memory:' ? 'in memory' : fs.existsSync(p) ? 'exists' : 'missing';
      return { path: p, text: `${p} (${state}; from ${source})` };
    } catch (err) {
      ok = false;
      return { path: null, text: `ERROR ${String(err && err.message).replace(/\s*\n\s*/g, ' ')}` };
    }
  };
  const shell = describe(process.env);
  const cli = describe(cliEnv(resolve(root, '.env')));
  console.log(`database:     ${shell.text}`);  // what this shell, db:migrate, and the dashboard use
  if (cli.path !== shell.path) {
    console.log(`database (scrum CLI, with .env): ${cli.text}`);
    console.log(
      'WARN: .env changes the database for the scrum CLI only. db:migrate, the dashboard, and the MCP server ' +
        'use the line above. Set SCRUM_DB_PATH in your shell profile instead, and pass the same path to claude mcp add.'
    );
  }
  console.log('The MCP server uses this path only if its registration passes the same SCRUM_DB_PATH (or none).');
}

printDbPaths().then(
  () => process.exit(ok ? 0 : 1),
  (err) => {
    console.log(`database:     ERROR ${err && err.message}`);
    process.exit(1);
  }
);
