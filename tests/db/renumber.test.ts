// Migration 0014 (#20): renumber existing duplicate epic, sprint, and issue
// numbers, log each change, then enforce uniqueness. Runs against a temp file
// copy, never a real database.
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { execFileSync, spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const folder = path.join(root, "drizzle");
const journal = JSON.parse(fs.readFileSync(path.join(folder, "meta", "_journal.json"), "utf8"));
const TAG = "0014_renumber_unique_numbers";

let tmp: string;

beforeAll(() => {
  execFileSync(path.join(root, "node_modules", ".bin", "tsc"), { cwd: root, stdio: "inherit" });
}, 120_000);

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agentscrum-renumber-"));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

/** A database migrated up to, but not including, 0014, seeded with duplicates. */
function seededPre0014(dbPath: string): void {
  const idx = journal.entries.findIndex((e: { tag: string }) => e.tag === TAG);
  expect(idx).toBeGreaterThan(0);
  const partial = path.join(tmp, "drizzle-pre-0014");
  fs.cpSync(folder, partial, { recursive: true });
  fs.writeFileSync(
    path.join(partial, "meta", "_journal.json"),
    JSON.stringify({ ...journal, entries: journal.entries.slice(0, idx) })
  );
  const db = new Database(dbPath);
  migrate(drizzle(db), { migrationsFolder: partial });
  const t = "2026-10-14T00:00:00.000Z";
  db.exec(`
    INSERT INTO projects (id, name, created_at) VALUES (1, 'a', '${t}'), (2, 'b', '${t}');
    -- project 1: sprints 1, 2, 2 (dup); project 2: sprint 1 (no dup with project 1)
    INSERT INTO sprints (id, project_id, number, status) VALUES
      (1, 1, 1, 'closed'), (2, 1, 2, 'active'), (3, 1, 2, 'planning'), (4, 2, 1, 'planning');
    -- project 1: epics 1, 1 (dup), 2; project 2: epic 1
    INSERT INTO epics (id, project_id, number, title, created_at) VALUES
      (1, 1, 1, 'E1', '${t}'), (2, 1, 1, 'E1 dup', '${t}'), (3, 1, 2, 'E2', '${t}'), (4, 2, 1, 'B1', '${t}');
    -- epic 1: issues 1, 2, 2, 2, 3 (two dups); epic 3: 0, 0 (old import default); epic 4: 1
    INSERT INTO issues (id, epic_id, number, title, created_at) VALUES
      (1, 1, 1, 'i1', '${t}'), (2, 1, 2, 'i2', '${t}'), (3, 1, 2, 'i2b', '${t}'),
      (4, 1, 2, 'i2c', '${t}'), (5, 1, 3, 'i3', '${t}'),
      (6, 3, 0, 'z1', '${t}'), (7, 3, 0, 'z2', '${t}'),
      (8, 4, 1, 'b1', '${t}');
  `);
  db.close();
}

function numbers(db: Database.Database, table: string): Record<number, number> {
  const rows = db.prepare(`SELECT id, number FROM ${table} ORDER BY id`).all() as { id: number; number: number }[];
  return Object.fromEntries(rows.map((r) => [r.id, r.number]));
}

test("renumbers later duplicates to the next free number and logs each change", () => {
  const dbPath = path.join(tmp, "copy.db");
  seededPre0014(dbPath);

  const db = new Database(dbPath);
  migrate(drizzle(db), { migrationsFolder: folder });

  expect(numbers(db, "sprints")).toEqual({ 1: 1, 2: 2, 3: 3, 4: 1 });
  expect(numbers(db, "epics")).toEqual({ 1: 1, 2: 3, 3: 2, 4: 1 });
  expect(numbers(db, "issues")).toEqual({ 1: 1, 2: 2, 3: 4, 4: 5, 5: 3, 6: 0, 7: 1, 8: 1 });

  const log = db
    .prepare("SELECT table_name, row_id, scope_id, old_number, new_number FROM renumber_log ORDER BY id")
    .all();
  expect(log).toEqual([
    { table_name: "epics", row_id: 2, scope_id: 1, old_number: 1, new_number: 3 },
    { table_name: "sprints", row_id: 3, scope_id: 1, old_number: 2, new_number: 3 },
    { table_name: "issues", row_id: 3, scope_id: 1, old_number: 2, new_number: 4 },
    { table_name: "issues", row_id: 4, scope_id: 1, old_number: 2, new_number: 5 },
    { table_name: "issues", row_id: 7, scope_id: 3, old_number: 0, new_number: 1 },
  ]);

  // The unique indexes now refuse a duplicate.
  const t = "2026-10-14T00:00:00.000Z";
  expect(() =>
    db.prepare("INSERT INTO issues (epic_id, number, title, created_at) VALUES (1, 1, 'x', ?)").run(t)
  ).toThrow(/UNIQUE constraint failed/);
  expect(() =>
    db.prepare("INSERT INTO epics (project_id, number, title, created_at) VALUES (1, 2, 'x', ?)").run(t)
  ).toThrow(/UNIQUE constraint failed/);
  expect(() => db.prepare("INSERT INTO sprints (project_id, number) VALUES (2, 1)").run()).toThrow(
    /UNIQUE constraint failed/
  );
  db.close();
});

test("a clean database migrates with an empty log", () => {
  const db = new Database(path.join(tmp, "clean.db"));
  migrate(drizzle(db), { migrationsFolder: folder });
  expect(db.prepare("SELECT COUNT(*) AS n FROM renumber_log").get()).toEqual({ n: 0 });
  db.close();
});

test("npm run db:migrate prints what it renumbered", () => {
  const dbPath = path.join(tmp, "cli.db");
  seededPre0014(dbPath);
  const run = () =>
    spawnSync(process.execPath, [path.join(root, "dist", "db", "migrate.js")], {
      env: { ...process.env, SCRUM_DB_PATH: dbPath },
      encoding: "utf8",
      timeout: 30_000,
    });

  const first = run();
  expect(first.status).toBe(0);
  expect(first.stdout).toContain("Renumbered 5 duplicate number(s)");
  expect(first.stdout).toContain("issues id 4 (epic 1): 2 -> 5");
  expect(first.stdout).toContain("sprints id 3 (project 1): 2 -> 3");

  // Running it again changes nothing and says nothing about renumbering.
  const second = run();
  expect(second.status).toBe(0);
  expect(second.stdout).not.toContain("Renumbered");
});

test("migrate-on-open notes the renumbering on stderr, not stdout", () => {
  const dbPath = path.join(tmp, "open.db");
  seededPre0014(dbPath);
  const run = () =>
    spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `const db = await import(${JSON.stringify(path.join(root, "dist", "db", "index.js"))}); db.getDb();`,
      ],
      { env: { ...process.env, SCRUM_DB_PATH: dbPath, SCRUM_MIGRATE_ON_OPEN: "1" }, encoding: "utf8", timeout: 30_000 }
    );
  const first = run();
  expect(first.status).toBe(0);
  expect(first.stdout).toBe("");
  expect(first.stderr).toContain("migration 0014 renumbered 5 duplicate");
  const second = run();
  expect(second.stderr).not.toContain("renumbered");
});

test("several processes opening an old database at once all succeed", async () => {
  // The first CLI or MCP calls after an upgrade can race to apply 0014.
  // Every one must end up with a migrated database, not a "table already
  // exists" error. Repeated because the race does not hit every time.
  const { spawn } = await import("child_process");
  for (let round = 0; round < 5; round++) {
    const dbPath = path.join(tmp, `race-${round}.db`);
    seededPre0014(dbPath);
    const start = path.join(tmp, `go-${round}`);
    const code = `
      import fs from "fs";
      while (!fs.existsSync(${JSON.stringify(start)})) await new Promise((r) => setTimeout(r, 2));
      const db = await import(${JSON.stringify(path.join(root, "dist", "db", "index.js"))});
      db.getDb();
    `;
    const runs = Array.from({ length: 6 }, () =>
      new Promise<{ code: number | null; stderr: string }>((resolve) => {
        const child = spawn(process.execPath, ["--input-type=module", "-e", code], {
          env: { ...process.env, SCRUM_DB_PATH: dbPath, SCRUM_MIGRATE_ON_OPEN: "1" },
          stdio: ["ignore", "ignore", "pipe"],
        });
        let stderr = "";
        child.stderr.on("data", (d) => (stderr += d));
        child.on("close", (c) => resolve({ code: c, stderr }));
      })
    );
    await new Promise((r) => setTimeout(r, 800));
    fs.writeFileSync(start, "");
    const results = await Promise.all(runs);
    for (const r of results) {
      expect(r.stderr).not.toMatch(/already exists|Error/);
      expect(r.code).toBe(0);
    }
    // Only the process that applied 0014 reports the renumbering.
    const notices = results.filter((r) => r.stderr.includes("migration 0014 renumbered")).length;
    expect(notices).toBe(1);
    const db = new Database(dbPath, { readonly: true });
    expect(db.prepare("SELECT COUNT(*) AS n FROM renumber_log").get()).toEqual({ n: 5 });
    db.close();
  }
}, 60_000);
