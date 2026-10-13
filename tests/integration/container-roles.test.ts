// Runs the container's entry point (docker/entrypoint.sh) natively against a
// temp database, the same way the image runs it: migrate as its own step, MCP
// with SCRUM_MIGRATE_ON_OPEN=0. The real image build and run are checked on a
// machine with Docker (see README "Container").
import { execFileSync, spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const entrypoint = path.join(root, "docker", "entrypoint.sh");

let tmp: string;

function run(role: string, args: string[], env: Record<string, string>) {
  return spawnSync("sh", [entrypoint, role, ...args], {
    env: { ...process.env, AGENTSCRUM_APP: root, SCRUM_MIGRATE_ON_OPEN: "0", ...env },
    encoding: "utf8",
    timeout: 60_000,
  });
}

beforeAll(() => {
  // The entry point runs compiled code, like the image.
  execFileSync(path.join(root, "node_modules", ".bin", "tsc"), { cwd: root, stdio: "inherit" });
}, 120_000);

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agentscrum-roles-"));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("migrate, then two MCP servers: round trip, one claim wins, stdout is clean", () => {
  const db = path.join(tmp, "agentscrum.db");
  const migrate = run("migrate", [], { SCRUM_DB_PATH: db });
  expect(migrate.status).toBe(0);

  // Repeat: the claim race must have exactly one winner every time.
  for (let i = 0; i < 3; i++) {
    const smoke = spawnSync(
      process.execPath,
      [path.join(root, "scripts", "mcp-smoke.mjs"), "--", "sh", entrypoint, "mcp"],
      {
        env: { ...process.env, AGENTSCRUM_APP: root, SCRUM_MIGRATE_ON_OPEN: "0", SCRUM_DB_PATH: db },
        encoding: "utf8",
        timeout: 60_000,
      }
    );
    const summary = JSON.parse(smoke.stdout);
    expect(summary.error).toBeUndefined();
    expect(summary.badStdoutLines).toEqual([]);
    expect(summary.tools).toBe(27);
    expect(summary.issue.status).toBe("done");
    expect(smoke.status).toBe(0);
  }

  // State survives restarts: every run's project is still there.
  const counts = run("counts", [db], {});
  expect(counts.stdout).toMatch(/projects: 3\b/);
}, 120_000);

test("MCP server with migrations off refuses a missing database and does not create it", () => {
  const db = path.join(tmp, "missing.db");
  const res = spawnSync("sh", [entrypoint, "mcp"], {
    env: { ...process.env, AGENTSCRUM_APP: root, SCRUM_MIGRATE_ON_OPEN: "0", SCRUM_DB_PATH: db },
    input: "",
    encoding: "utf8",
    timeout: 30_000,
  });
  expect(res.status).toBe(1);
  expect(res.stdout).toBe("");
  expect(res.stderr).toMatch(/database not found.*Run the migrate step/s);
  expect(fs.existsSync(db)).toBe(false);
});

test("MCP server with migrations off refuses an unmigrated database", () => {
  const db = path.join(tmp, "empty.db");
  fs.writeFileSync(db, "");
  const res = spawnSync("sh", [entrypoint, "mcp"], {
    env: { ...process.env, AGENTSCRUM_APP: root, SCRUM_MIGRATE_ON_OPEN: "0", SCRUM_DB_PATH: db },
    input: "",
    encoding: "utf8",
    timeout: 30_000,
  });
  expect(res.status).toBe(1);
  expect(res.stderr).toMatch(/no migrations applied/);
  expect(fs.statSync(db).size).toBe(0);
});

test("backup, restore into a separate file, and import keep every row", () => {
  const db = path.join(tmp, "agentscrum.db");
  expect(run("migrate", [], { SCRUM_DB_PATH: db }).status).toBe(0);
  const init = run("cli", ["init", "demo"], { SCRUM_DB_PATH: db });
  expect(init.status).toBe(0);
  expect(run("cli", ["demo", "epic", "add", "Core"], { SCRUM_DB_PATH: db }).status).toBe(0);

  const backupFile = path.join(tmp, "backups", "snap.db");
  const backup = run("backup", ["--out", backupFile], { SCRUM_DB_PATH: db });
  expect(backup.stderr).toBe("");
  expect(backup.status).toBe(0);

  const restored = path.join(tmp, "restore", "agentscrum.db");
  const restore = run("restore", [backupFile, "--to", restored], {});
  expect(restore.status).toBe(0);
  expect(restore.stdout).toMatch(/row counts match/);

  const original = run("counts", [db], {}).stdout;
  expect(run("counts", [restored], {}).stdout).toBe(original);
  expect(original).toMatch(/epics: 1\b/);

  // Never overwrites an existing database.
  const again = run("restore", [backupFile, "--to", restored], {});
  expect(again.status).toBe(1);
  expect(again.stderr).toMatch(/already exists/);

  // Import copies into an empty target only.
  const imported = path.join(tmp, "volume", "agentscrum.db");
  expect(run("import", [db], { SCRUM_DB_PATH: imported }).status).toBe(0);
  expect(run("counts", [imported], {}).stdout).toBe(original);
  expect(run("import", [db], { SCRUM_DB_PATH: imported }).status).toBe(1);
}, 60_000);

test("unknown role fails with the list of roles", () => {
  const res = run("nope", [], {});
  expect(res.status).toBe(64);
  expect(res.stderr).toMatch(/roles: migrate, dashboard, mcp/);
});
