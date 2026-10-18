// #20: several processes writing to the same project and epic at once must
// never get the same epic, sprint, or issue number. Separate processes cannot
// share an in-memory database, so this uses a temp file.
import { execFileSync, spawn } from "child_process";
import Database from "better-sqlite3";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const scrumModule = path.join(root, "dist", "services", "scrum.js");

const WRITERS = 4;
const PER_WRITER = 60;

let tmp: string;

beforeAll(() => {
  execFileSync(path.join(root, "node_modules", ".bin", "tsc"), { cwd: root, stdio: "inherit" });
}, 120_000);

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agentscrum-race-"));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

// Each child waits for the start file, then creates rows as fast as it can.
const childSource = `
import fs from "fs";
const [modulePath, startFile, kind, projectId, epicId, count] = process.argv.slice(2);
const scrum = await import(modulePath);
while (!fs.existsSync(startFile)) await new Promise((r) => setTimeout(r, 5));
for (let i = 0; i < Number(count); i++) {
  if (kind === "issue") scrum.createIssue(Number(epicId), null, "race " + process.pid + " " + i);
  else if (kind === "epic") scrum.createEpic(Number(projectId), "race epic " + i);
  else scrum.createSprint(Number(projectId));
}
`;

function runChild(script: string, dbPath: string, args: string[]): Promise<{ code: number | null; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [script, scrumModule, ...args], {
      env: { ...process.env, SCRUM_DB_PATH: dbPath },
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (d) => (stderr += d));
    child.on("close", (code) => resolve({ code, stderr }));
  });
}

test(
  "concurrent writers get distinct, gap-free numbers",
  async () => {
    const dbPath = path.join(tmp, "race.db");
    const script = path.join(tmp, "writer.mjs");
    const startFile = path.join(tmp, "go");
    fs.writeFileSync(script, childSource);

    // Migrate and create the project and epic once, in this process's child, so
    // the writers only race on numbering.
    execFileSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `const s = await import(${JSON.stringify(scrumModule)});
         const { project } = s.initProject("race");
         s.createEpic(project.id, "shared");`,
      ],
      { env: { ...process.env, SCRUM_DB_PATH: dbPath } }
    );

    const jobs: Promise<{ code: number | null; stderr: string }>[] = [];
    for (let w = 0; w < WRITERS; w++) {
      jobs.push(runChild(script, dbPath, [startFile, "issue", "1", "1", String(PER_WRITER)]));
      jobs.push(runChild(script, dbPath, [startFile, "epic", "1", "1", String(PER_WRITER / 4)]));
      jobs.push(runChild(script, dbPath, [startFile, "sprint", "1", "1", String(PER_WRITER / 4)]));
    }
    // Give every child time to load before releasing them together.
    await new Promise((r) => setTimeout(r, 1500));
    fs.writeFileSync(startFile, "");
    const results = await Promise.all(jobs);
    for (const r of results) {
      expect(r.stderr).toBe("");
      expect(r.code).toBe(0);
    }

    const db = new Database(dbPath, { readonly: true });
    const col = (q: string) => (db.prepare(q).all() as { n: number }[]).map((r) => r.n);
    const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

    // 1 seed epic + the writers' epics; Sprint 1 from init + the writers' sprints.
    expect(col("SELECT number AS n FROM issues WHERE epic_id = 1 ORDER BY number")).toEqual(
      range(WRITERS * PER_WRITER)
    );
    expect(col("SELECT number AS n FROM epics WHERE project_id = 1 ORDER BY number")).toEqual(
      range(1 + WRITERS * (PER_WRITER / 4))
    );
    expect(col("SELECT number AS n FROM sprints WHERE project_id = 1 ORDER BY number")).toEqual(
      range(1 + WRITERS * (PER_WRITER / 4))
    );
    db.close();
  },
  120_000
);
