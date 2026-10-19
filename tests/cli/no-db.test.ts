// The CLI must not open, create, or migrate the database for help and version
// output (#17), and working-directory detection must pick the closest project
// (#12). Runs the compiled CLI against temp database files only.
import { execFileSync, spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const cli = path.join(root, "dist", "cli", "index.js");

let tmp: string;

function scrum(args: string[], opts: { cwd?: string; env?: Record<string, string> } = {}) {
  const env: Record<string, string | undefined> = { ...process.env, ...opts.env };
  delete env["SCRUM_PROJECT_ID"];
  delete env["AGENTSCRUM_DB_PATH"];
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: opts.cwd ?? tmp,
    env,
    encoding: "utf8",
    timeout: 30_000,
  });
}

beforeAll(() => {
  execFileSync(path.join(root, "node_modules", ".bin", "tsc"), { cwd: root, stdio: "inherit" });
}, 120_000);

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agentscrum-cli-"));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

const infoCommands: string[][] = [
  ["--help"],
  ["-h"],
  ["--version"],
  ["-V"],
  ["help"],
  ["issue", "--help"],
  ["help", "issue"],
  ["myproject", "--help"],
  ["myproject", "issue", "--help"],
  ["myproject", "help", "issue"],
];

test.each(infoCommands)("scrum %s never touches the database", (...args) => {
  const db = path.join(tmp, "missing.db");
  const result = scrum(args, { env: { SCRUM_DB_PATH: db } });
  expect(result.status).toBe(0);
  expect(result.stdout.length).toBeGreaterThan(0);
  for (const suffix of ["", "-wal", "-shm"]) {
    expect(fs.existsSync(db + suffix)).toBe(false);
  }
});

test("working-directory detection picks the nested project (#12)", () => {
  const db = path.join(tmp, "nested.db");
  const outer = path.join(tmp, "x");
  const inner = path.join(outer, "projects", "inner");
  const deep = path.join(inner, "src");
  fs.mkdirSync(deep, { recursive: true });
  const env = { SCRUM_DB_PATH: db };

  expect(scrum(["init", "outer"], { cwd: outer, env }).status).toBe(0);
  expect(scrum(["init", "inner"], { cwd: inner, env }).status).toBe(0);
  const add = scrum(["epic", "add", "Foo"], { cwd: deep, env });
  expect(add.stderr).toBe("");
  expect(add.status).toBe(0);

  const innerEpics = scrum(["inner", "epic", "list"], { env });
  const outerEpics = scrum(["outer", "epic", "list"], { env });
  expect(innerEpics.stdout).toContain("Foo");
  expect(outerEpics.stdout).not.toContain("Foo");
});

test("an explicit project name still wins over the working directory", () => {
  const db = path.join(tmp, "explicit.db");
  const a = path.join(tmp, "a");
  const b = path.join(tmp, "b");
  fs.mkdirSync(a);
  fs.mkdirSync(b);
  const env = { SCRUM_DB_PATH: db };
  expect(scrum(["init", "alpha"], { cwd: a, env }).status).toBe(0);
  expect(scrum(["init", "beta"], { cwd: b, env }).status).toBe(0);

  expect(scrum(["beta", "epic", "add", "Bar"], { cwd: a, env }).status).toBe(0);
  expect(scrum(["beta", "epic", "list"], { env }).stdout).toContain("Bar");
  expect(scrum(["alpha", "epic", "list"], { env }).stdout).not.toContain("Bar");

  // "-h" as an option value is not a help request: the named project must
  // still be used, not the working directory's.
  const add = scrum(["beta", "issue", "add", "1", "Baz", "-d", "-h", "--sprint", "1"], { cwd: a, env });
  expect(add.stderr).toBe("");
  expect(add.status).toBe(0);
  const issues = JSON.parse(scrum(["beta", "issue", "list", "--json"], { env }).stdout).issues;
  const betaSprints = JSON.parse(scrum(["beta", "sprint", "list", "--json"], { env }).stdout);
  const baz = issues.find((i: { title: string }) => i.title === "Baz");
  expect(baz.description).toBe("-h");
  // The sprint must be beta's own Sprint 1, not alpha's.
  expect(betaSprints.map((sp: { id: number }) => sp.id)).toContain(baz.sprintId);
  expect(scrum(["alpha", "issue", "list"], { env }).stdout).not.toContain("Baz");

  const unknown = scrum(["nope", "epic", "list"], { cwd: a, env });
  expect(unknown.status).toBe(1);
  expect(unknown.stderr).toContain('Project "nope" not found');

  // A mistyped project or command on its own still fails rather than printing help.
  const typo = scrum(["statsu"], { cwd: a, env });
  expect(typo.status).toBe(1);
  expect(typo.stderr).toContain('Project "statsu" not found');
});

test("a named project with no database file fails and creates nothing (#30)", () => {
  const db = path.join(tmp, "typo.db");
  for (const args of [["nope", "epic", "list"], ["nope"]]) {
    const result = scrum(args, { env: { SCRUM_DB_PATH: db } });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`No database at ${db}`);
    for (const suffix of ["", "-wal", "-shm"]) {
      expect(fs.existsSync(db + suffix)).toBe(false);
    }
  }
});
