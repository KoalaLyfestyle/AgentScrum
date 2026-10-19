// #33: several processes opening a brand-new database file at once. Switching
// a file to WAL needs a brief exclusive lock, and SQLite answers SQLITE_BUSY at
// once there instead of waiting for the busy timeout. getDb() retries that one
// step. Runs against temp files only.
import Database from "better-sqlite3";
import { execFileSync, spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
let tmp: string;

beforeAll(() => {
  execFileSync(path.join(root, "node_modules", ".bin", "tsc"), { cwd: root, stdio: "inherit" });
}, 120_000);

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agentscrum-first-open-"));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("six processes opening a brand-new database at once all succeed", async () => {
  const ROUNDS = 8;
  for (let round = 0; round < ROUNDS; round++) {
    const dbPath = path.join(tmp, `new-${round}.db`);
    const start = path.join(tmp, `go-${round}`);
    const code = `
      import fs from "fs";
      while (!fs.existsSync(${JSON.stringify(start)})) await new Promise((r) => setTimeout(r, 1));
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
    await new Promise((r) => setTimeout(r, 600));
    fs.writeFileSync(start, "");
    const results = await Promise.all(runs);
    for (const r of results) {
      expect(r.stderr).not.toMatch(/locked|already exists|Error/);
      expect(r.code).toBe(0);
    }
    const db = new Database(dbPath, { readonly: true });
    expect(db.pragma("journal_mode", { simple: true })).toBe("wal");
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((t: any) => t.name);
    expect(tables).toEqual(expect.arrayContaining(["projects", "issues", "renumber_log"]));
    db.close();
  }
}, 120_000);

test("getDb waits out a lock that makes the WAL switch fail at once", async () => {
  // A deterministic stand-in for the race above: while another connection
  // holds a write lock on a file that is not in WAL mode yet, the switch
  // answers SQLITE_BUSY straight away (no busy timeout). Release the lock
  // 300 ms after the other process starts opening; it must retry and succeed.
  const dbPath = path.join(tmp, "locked.db");
  const holder = new Database(dbPath);
  holder.exec("CREATE TABLE placeholder (x)");
  holder.exec("BEGIN IMMEDIATE");
  const ready = path.join(tmp, "ready");
  const code = `
    const db = await import(${JSON.stringify(path.join(root, "dist", "db", "index.js"))});
    (await import("fs")).writeFileSync(${JSON.stringify(ready)}, "");
    db.getDb();
  `;
  const run = new Promise<{ code: number | null; stderr: string }>((resolve) => {
    const child = spawn(process.execPath, ["--input-type=module", "-e", code], {
      env: { ...process.env, SCRUM_DB_PATH: dbPath, SCRUM_MIGRATE_ON_OPEN: "1" },
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (d) => (stderr += d));
    child.on("close", (c) => resolve({ code: c, stderr }));
  });
  while (!fs.existsSync(ready)) await new Promise((r) => setTimeout(r, 5));
  await new Promise((r) => setTimeout(r, 300));
  holder.exec("COMMIT");
  holder.close();
  const result = await run;
  expect(result.stderr).not.toMatch(/locked|Error/);
  expect(result.code).toBe(0);
  const db = new Database(dbPath, { readonly: true });
  expect(db.pragma("journal_mode", { simple: true })).toBe("wal");
  db.close();
}, 60_000);

describe("switchToWal", () => {
  const busy = () => Object.assign(new Error("database is locked"), { code: "SQLITE_BUSY" });

  test("retries SQLITE_BUSY, then succeeds", async () => {
    const { switchToWal } = await import("../../src/db/index.js");
    let calls = 0;
    const waits: number[] = [];
    switchToWal(
      {
        pragma: () => {
          calls++;
          if (calls < 3) throw busy();
          return "wal";
        },
      },
      (ms) => waits.push(ms)
    );
    expect(calls).toBe(3);
    expect(waits).toHaveLength(2);
    for (const ms of waits) expect(ms).toBeGreaterThanOrEqual(10);
  });

  test("throws any other error at once, without retrying", async () => {
    const { switchToWal } = await import("../../src/db/index.js");
    let calls = 0;
    const corrupt = Object.assign(new Error("database disk image is malformed"), { code: "SQLITE_CORRUPT" });
    expect(() =>
      switchToWal(
        {
          pragma: () => {
            calls++;
            throw corrupt;
          },
        },
        () => undefined
      )
    ).toThrow("malformed");
    expect(calls).toBe(1);
  });

  test("gives up after WAL_SWITCH_TRIES busy answers and throws the busy error", async () => {
    const { switchToWal, WAL_SWITCH_TRIES } = await import("../../src/db/index.js");
    let calls = 0;
    expect(() =>
      switchToWal(
        {
          pragma: () => {
            calls++;
            throw busy();
          },
        },
        () => undefined
      )
    ).toThrow("database is locked");
    expect(calls).toBe(WAL_SWITCH_TRIES);
  });
});
