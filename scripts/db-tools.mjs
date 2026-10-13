#!/usr/bin/env node
// SQLite-aware backup, restore, and import for AgentScrum.
//
// Uses better-sqlite3's online backup API, which copies a consistent snapshot
// that includes anything still in the WAL. Never copy agentscrum.db by hand
// while it is in use: the -wal file may hold recent writes.
//
//   backup  [--out FILE]        snapshot $SCRUM_DB_PATH into FILE
//                               (default /backups/agentscrum-<UTC time>.db)
//   restore FILE [--to TARGET]  restore FILE into TARGET (default /restore/agentscrum.db)
//                               and check that row counts match. TARGET must not exist.
//   import  FILE                copy an existing database (opened read-only) into
//                               $SCRUM_DB_PATH. $SCRUM_DB_PATH must not exist.
//   counts  FILE                print row counts per table
//
// Output is plain text on stdout; errors go to stderr with exit code 1.
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

function fail(message) {
  process.stderr.write(`db-tools: ${message}\n`);
  process.exit(1);
}

function option(args, name) {
  const i = args.indexOf(name);
  if (i === -1) return undefined;
  const value = args[i + 1];
  if (!value) fail(`${name} needs a value`);
  args.splice(i, 2);
  return value;
}

function openReadOnly(file) {
  if (!fs.existsSync(file)) fail(`no database at ${file}`);
  return new Database(file, { readonly: true, fileMustExist: true });
}

function rowCounts(db) {
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all()
    .map((r) => r.name);
  const counts = {};
  for (const t of tables) {
    counts[t] = db.prepare(`SELECT COUNT(*) AS n FROM "${t.replaceAll('"', '""')}"`).get().n;
  }
  return counts;
}

function printCounts(counts) {
  for (const [table, n] of Object.entries(counts)) process.stdout.write(`  ${table}: ${n}\n`);
}

function sameCounts(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Snapshot `from` (opened read-only) into a new file `to`. */
async function copyInto(from, to) {
  if (fs.existsSync(to)) fail(`${to} already exists; refusing to overwrite it`);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  const src = openReadOnly(from);
  try {
    await src.backup(to);
    const dest = new Database(to, { fileMustExist: true });
    try {
      const check = dest.pragma("integrity_check", { simple: true });
      if (check !== "ok") fail(`integrity check failed on ${to}: ${check}`);
      dest.pragma("journal_mode = WAL");
      const before = rowCounts(src);
      const after = rowCounts(dest);
      if (!sameCounts(before, after)) fail(`row counts differ after copying ${from} to ${to}`);
      return after;
    } finally {
      dest.close();
    }
  } finally {
    src.close();
  }
}

function stamp() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
}

async function main(argv) {
  const args = [...argv];
  const command = args.shift();
  const dbPath = process.env.SCRUM_DB_PATH;
  switch (command) {
    case "backup": {
      if (!dbPath) fail("SCRUM_DB_PATH is not set");
      const out = option(args, "--out") ?? `/backups/agentscrum-${stamp()}.db`;
      const counts = await copyInto(dbPath, out);
      process.stdout.write(`Backed up ${dbPath} to ${out}\n`);
      printCounts(counts);
      return;
    }
    case "restore": {
      const to = option(args, "--to") ?? "/restore/agentscrum.db";
      const from = args.shift() ?? fail("restore needs a backup file");
      const counts = await copyInto(from, to);
      process.stdout.write(`Restored ${from} into ${to}; row counts match.\n`);
      printCounts(counts);
      return;
    }
    case "import": {
      if (!dbPath) fail("SCRUM_DB_PATH is not set");
      const from = args.shift() ?? fail("import needs a source database file");
      const counts = await copyInto(from, dbPath);
      process.stdout.write(`Imported ${from} into ${dbPath}; row counts match.\n`);
      printCounts(counts);
      return;
    }
    case "counts": {
      const file = args.shift() ?? dbPath ?? fail("counts needs a database file");
      const db = openReadOnly(file);
      try {
        printCounts(rowCounts(db));
      } finally {
        db.close();
      }
      return;
    }
    default:
      fail("usage: db-tools.mjs backup [--out FILE] | restore FILE [--to TARGET] | import FILE | counts FILE");
  }
}

await main(process.argv.slice(2));
