#!/usr/bin/env node
// SQLite-aware backup, restore, and import for AgentScrum.
//
// Uses better-sqlite3's online backup API, which copies a consistent snapshot
// that includes anything still in the WAL. Never copy agentscrum.db by hand
// while it is in use: the -wal file may hold recent writes.
//
//   backup  [--out FILE]        snapshot $SCRUM_DB_PATH into FILE
//                               (default /backups/agentscrum-<UTC time>.db).
//                               The file is self-contained (no -wal), readable from a
//                               read-only folder.
//   restore FILE [--to TARGET]  restore FILE into TARGET (default /restore/agentscrum.db)
//                               and check that row counts match. TARGET must not exist.
//   import  FILE                copy an existing database (opened read-only) into
//                               $SCRUM_DB_PATH. $SCRUM_DB_PATH must not exist.
//   counts  FILE                print row counts per table
//
// Output is plain text on stdout; errors go to stderr with exit code 1.
import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
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

/**
 * Open a source database read-only. A WAL database in a read-only folder
 * cannot be opened in place when its -shm file is missing, so fall back to a
 * private temp copy of the file (plus -wal, if present). Returns { db, cleanup }.
 */
function openSource(file) {
  if (!fs.existsSync(file)) fail(`no database at ${file}`);
  try {
    const db = new Database(file, { readonly: true, fileMustExist: true });
    db.prepare("SELECT COUNT(*) FROM sqlite_master").get(); // force the WAL index open
    return { db, cleanup: () => db.close() };
  } catch (err) {
    if (!/readonly|unable to open|SQLITE_CANTOPEN|SQLITE_READONLY/i.test(String(err?.code ?? err?.message))) throw err;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agentscrum-src-"));
    const copy = path.join(dir, path.basename(file));
    fs.copyFileSync(file, copy);
    if (fs.existsSync(`${file}-wal`)) fs.copyFileSync(`${file}-wal`, `${copy}-wal`);
    const db = new Database(copy, { readonly: true, fileMustExist: true });
    return {
      db,
      cleanup: () => {
        db.close();
        fs.rmSync(dir, { recursive: true, force: true });
      },
    };
  }
}

/**
 * Snapshot `from` into a new file `to` with SQLite's online backup API.
 * mode "backup": the output is a standalone file in rollback-journal mode, so
 *   it can be read later from a read-only folder.
 * mode "database": the output is a working database in WAL mode, and its row
 *   counts must match the source (the source is not expected to change).
 * On any failure the partial output is removed.
 */
async function copyInto(from, to, mode) {
  if (fs.existsSync(to)) fail(`${to} already exists; refusing to overwrite it`);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  const src = openSource(from);
  let ok = false;
  try {
    await src.db.backup(to);
    const dest = new Database(to, { fileMustExist: true });
    try {
      const check = dest.pragma("integrity_check", { simple: true });
      if (check !== "ok") throw new Error(`integrity check failed on ${to}: ${check}`);
      dest.pragma(mode === "backup" ? "journal_mode = DELETE" : "journal_mode = WAL");
      const after = rowCounts(dest);
      if (mode === "database" && !sameCounts(rowCounts(src.db), after)) {
        throw new Error(`row counts differ after copying ${from} to ${to}`);
      }
      ok = true;
      return after;
    } finally {
      dest.close();
    }
  } finally {
    src.cleanup();
    if (!ok) for (const f of [to, `${to}-wal`, `${to}-shm`]) fs.rmSync(f, { force: true });
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
      const counts = await copyInto(dbPath, out, "backup");
      process.stdout.write(`Backed up ${dbPath} to ${out}\n`);
      printCounts(counts);
      return;
    }
    case "restore": {
      const to = option(args, "--to") ?? "/restore/agentscrum.db";
      const from = args.shift() ?? fail("restore needs a backup file");
      const counts = await copyInto(from, to, "database");
      process.stdout.write(`Restored ${from} into ${to}; row counts match.\n`);
      printCounts(counts);
      return;
    }
    case "import": {
      if (!dbPath) fail("SCRUM_DB_PATH is not set");
      const from = args.shift() ?? fail("import needs a source database file");
      const counts = await copyInto(from, dbPath, "database");
      process.stdout.write(`Imported ${from} into ${dbPath}; row counts match.\n`);
      printCounts(counts);
      return;
    }
    case "counts": {
      const file = args.shift() ?? dbPath ?? fail("counts needs a database file");
      const src = openSource(file);
      try {
        printCounts(rowCounts(src.db));
      } finally {
        src.cleanup();
      }
      return;
    }
    default:
      fail("usage: db-tools.mjs backup [--out FILE] | restore FILE [--to TARGET] | import FILE | counts FILE");
  }
}

try {
  await main(process.argv.slice(2));
} catch (err) {
  fail(err instanceof Error ? err.message : String(err));
}
