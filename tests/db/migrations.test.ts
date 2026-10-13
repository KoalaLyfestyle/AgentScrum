import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { getMigrationStatus } from "../../src/db/migrations.js";
import { MIGRATE_ON_OPEN_ENV, setMigrateOnOpen, shouldMigrateOnOpen } from "../../src/db/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const folder = path.join(root, "drizzle");
const journal = JSON.parse(fs.readFileSync(path.join(folder, "meta", "_journal.json"), "utf8"));

describe("getMigrationStatus", () => {
  test("a new database has every migration pending", () => {
    const db = new Database(":memory:");
    const status = getMigrationStatus(db, folder);
    expect(status.ok).toBe(false);
    expect(status.pending).toHaveLength(journal.entries.length);
    expect(status.reason).toBe("database has no migrations applied");
    // Read-only: no migrations table was created.
    expect(db.prepare("SELECT COUNT(*) AS n FROM sqlite_master").get()).toEqual({ n: 0 });
  });

  test("a fully migrated database is ok", () => {
    const db = new Database(":memory:");
    migrate(drizzle(db), { migrationsFolder: folder });
    expect(getMigrationStatus(db, folder)).toEqual({
      ok: true,
      expected: journal.entries.length,
      pending: [],
      reason: undefined,
    });
  });

  test("a database missing the newest migration reports it", () => {
    const partial = fs.mkdtempSync(path.join(os.tmpdir(), "agentscrum-mig-"));
    fs.cpSync(folder, partial, { recursive: true });
    const short = { ...journal, entries: journal.entries.slice(0, -1) };
    fs.writeFileSync(path.join(partial, "meta", "_journal.json"), JSON.stringify(short));
    const db = new Database(":memory:");
    migrate(drizzle(db), { migrationsFolder: partial });
    const status = getMigrationStatus(db, folder);
    expect(status.ok).toBe(false);
    expect(status.pending).toEqual([journal.entries.at(-1).tag]);
    fs.rmSync(partial, { recursive: true, force: true });
  });
});

describe("shouldMigrateOnOpen", () => {
  const saved = process.env[MIGRATE_ON_OPEN_ENV];
  afterEach(() => {
    if (saved === undefined) delete process.env[MIGRATE_ON_OPEN_ENV];
    else process.env[MIGRATE_ON_OPEN_ENV] = saved;
  });

  test("defaults to on, and SCRUM_MIGRATE_ON_OPEN=0 turns it off", () => {
    delete process.env[MIGRATE_ON_OPEN_ENV];
    expect(shouldMigrateOnOpen()).toBe(true);
    for (const off of ["0", "false", "off", "no"]) {
      process.env[MIGRATE_ON_OPEN_ENV] = off;
      expect(shouldMigrateOnOpen()).toBe(false);
    }
    process.env[MIGRATE_ON_OPEN_ENV] = "1";
    expect(shouldMigrateOnOpen()).toBe(true);
  });

  test("setMigrateOnOpen overrides the environment", () => {
    process.env[MIGRATE_ON_OPEN_ENV] = "0";
    setMigrateOnOpen(true);
    expect(shouldMigrateOnOpen()).toBe(true);
  });
});
