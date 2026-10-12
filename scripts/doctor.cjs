#!/usr/bin/env node
'use strict';
// Prints the Node runtime and checks that better-sqlite3 loads in it.
// Usage: npm run doctor            (uses the node on PATH)
//        /path/to/node scripts/doctor.cjs   (check the node an MCP client uses)
// Read-only: opens an in-memory database only. Never touches agentscrum.db.
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
process.exit(ok ? 0 : 1);
