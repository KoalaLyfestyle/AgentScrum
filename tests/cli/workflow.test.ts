// CLI commands for the workflow steps that used to be MCP only (#27). Each test
// runs the compiled CLI against a temp database. The work package and issue
// detail are also read through the MCP server on the same database, to check
// that the CLI's --json gives the same result as the tool.
import { execFileSync, spawn, spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const cli = path.join(root, "dist", "cli", "index.js");
const mcpServer = path.join(root, "dist", "mcp", "server.js");

let tmp: string;
let db: string;

function env(): Record<string, string | undefined> {
  const e: Record<string, string | undefined> = { ...process.env, SCRUM_DB_PATH: db, COST_SOURCE: "manual" };
  delete e["SCRUM_PROJECT_ID"];
  delete e["AGENTSCRUM_DB_PATH"];
  return e;
}

function scrum(...args: string[]) {
  return spawnSync(process.execPath, [cli, ...args], { cwd: tmp, env: env(), encoding: "utf8", timeout: 30_000 });
}

/** Run a CLI command that must succeed with --json, and parse its stdout. */
function json<T = any>(...args: string[]): T {
  const r = scrum(...args, "--json");
  if (r.status !== 0) throw new Error(`scrum ${args.join(" ")} failed: ${r.stderr}`);
  return JSON.parse(r.stdout) as T;
}

/** Call one MCP tool on a fresh server process over stdio. */
async function mcpCall(name: string, args: Record<string, unknown>): Promise<any> {
  const proc = spawn(process.execPath, [mcpServer], { cwd: tmp, env: env(), stdio: ["pipe", "pipe", "pipe"] });
  const responses = new Map<number, any>();
  let buffer = "";
  const done = new Promise<void>((resolve, reject) => {
    proc.stdout.setEncoding("utf8");
    proc.stdout.on("data", (chunk: string) => {
      buffer += chunk;
      let nl;
      while ((nl = buffer.indexOf("\n")) !== -1) {
        const msg = JSON.parse(buffer.slice(0, nl));
        buffer = buffer.slice(nl + 1);
        if (msg.id !== undefined) responses.set(msg.id, msg);
        if (responses.has(2)) resolve();
      }
    });
    proc.on("exit", (code) => reject(new Error(`MCP server exited with ${code}`)));
  });
  const send = (m: object) => proc.stdin.write(JSON.stringify(m) + "\n");
  send({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1" } } });
  send({ jsonrpc: "2.0", method: "notifications/initialized" });
  send({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name, arguments: args } });
  await done;
  proc.removeAllListeners("exit");
  proc.stdin.end();
  const result = responses.get(2).result;
  if (result.isError) throw new Error(result.content[0].text);
  return JSON.parse(result.content[0].text);
}

beforeAll(() => {
  execFileSync(path.join(root, "node_modules", ".bin", "tsc"), { cwd: root, stdio: "inherit" });
}, 120_000);

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agentscrum-workflow-"));
  db = path.join(tmp, "workflow.db");
  // `init` asks for DoD items; closed stdin answers with none.
  expect(spawnSync(process.execPath, [cli, "init", "demo"], { cwd: tmp, env: env(), encoding: "utf8", input: "" }).status).toBe(0);
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

/** A project with an active sprint 1, one epic, one 3-point issue with two ACs, and one DoD item. */
function seed() {
  expect(scrum("demo", "epic", "add", "Checkout").status).toBe(0);
  const epic = json<{ id: number }[]>("demo", "epic", "list")[0]!;
  scrum("demo", "issue", "add", String(epic.id), "Pay by card", "--points", "3", "--sprint", "1");
  const issue = json<{ issues: { id: number }[] }>("demo", "issue", "list").issues[0]!;
  scrum("demo", "issue", "ac", String(issue.id), "Card is masked");
  scrum("demo", "issue", "ac", String(issue.id), "Failure shows a reason");
  scrum("demo", "dod", "add", "Tests pass");
  const started = json("demo", "sprint", "start", "1", "--goal", "Take payments");
  return { epicId: epic.id as number, issueId: issue.id, sprintId: started.id as number };
}

test("sprint start, create, and close move sprints through their states", () => {
  const started = json("demo", "sprint", "start", "1", "--goal", "Ship");
  expect(started).toMatchObject({ number: 1, status: "active", goal: "Ship" });
  const created = json("demo", "sprint", "create");
  expect(created).toMatchObject({ number: 2, status: "planning" });
  expect(json("demo", "sprint", "close", "1")).toMatchObject({ number: 1, status: "closed" });
  expect(scrum("demo", "sprint", "start", "9").status).toBe(1);
});

test("work gives the same package as scrum_get_work_package", async () => {
  const { issueId } = seed();
  const pid = json<{ id: number; name: string }[]>("project", "list").find((p) => p.name === "demo")!.id;
  const fromCli = json("demo", "work", "--capacity", "5", "--agent", "agent-a");
  const fromMcp = await mcpCall("scrum_get_work_package", { project_id: pid, capacity: 5, agent_id: "agent-a" });
  expect(fromCli).toEqual(fromMcp);
  expect(fromCli.issues.map((i: { id: number }) => i.id)).toEqual([issueId]);
  expect(scrum("demo", "work", "--capacity", "0").status).toBe(1);
  expect(scrum("demo", "work").status).not.toBe(0);
});

test("issue claim lets one agent hold an issue until it releases it", () => {
  const { issueId } = seed();
  const id = String(issueId);
  expect(json("demo", "issue", "claim", id, "--by", "agent-a")).toMatchObject({ id: issueId, claimedBy: "agent-a" });
  const second = scrum("demo", "issue", "claim", id, "--by", "agent-b");
  expect(second.status).toBe(1);
  expect(second.stderr).toContain("already claimed");
  const wrongRelease = scrum("demo", "issue", "release", id, "--by", "agent-b");
  expect(wrongRelease.status).toBe(1);
  expect(json("demo", "issue", "release", id, "--by", "agent-a")).toMatchObject({ id: issueId, claimedBy: null });
  expect(json("demo", "issue", "claim", id, "--by", "agent-b", "--session", "s-1")).toMatchObject({
    claimedBy: "agent-b",
    claimSessionId: "s-1",
  });
});

test("ac-done, status, log, and show work together, and show matches scrum_get_issue_detail", async () => {
  const { issueId } = seed();
  const id = String(issueId);
  const before = json("demo", "issue", "show", id);
  expect(before.acs).toHaveLength(2);
  const ac = json("demo", "issue", "ac-done", String(before.acs[0].id));
  expect(ac).toMatchObject({ id: before.acs[0].id, completed: true });
  expect(json("demo", "issue", "status", id, "in_progress")).toMatchObject({ id: issueId, status: "in_progress" });
  const session = json("demo", "log", id, "Masked the card", "--tokens", "1200", "--auditor", "pass");
  expect(session).toMatchObject({ issueId, summary: "Masked the card", tokensUsed: 1200, auditor: "pass" });

  const fromCli = json("demo", "issue", "show", id);
  expect(fromCli).toEqual(await mcpCall("scrum_get_issue_detail", { issue_id: issueId }));
  expect(fromCli.acs.map((a: { completed: boolean }) => a.completed)).toEqual([true, false]);
  expect(fromCli.tokensUsed).toBe(1200);
});

test("dod done ticks an item for the active sprint, or a named one, and is safe to repeat", () => {
  const { sprintId } = seed();
  const [item] = json<{ id: number }[]>("demo", "dod", "list");
  const first = json("demo", "dod", "done", String(item!.id));
  expect(first).toMatchObject({ sprintId, dodItemId: item!.id, dodText: "Tests pass" });
  expect(json("demo", "dod", "done", String(item!.id), "--sprint", "1")).toEqual(first);
  expect(json("demo", "work", "-c", "5").dod).toEqual([{ id: item!.id, text: "Tests pass", completed: true }]);
});

test("dod done without an active sprint asks for --sprint", () => {
  scrum("demo", "dod", "add", "Tests pass");
  const r = scrum("demo", "dod", "done", "1");
  expect(r.status).toBe(1);
  expect(r.stderr).toContain("--sprint");
});

test("decision add and lesson add record what later agents read", () => {
  seed();
  const decision = json(
    "demo", "decision", "add", "Use SQLite", "--context", "One machine", "--decision", "SQLite in WAL mode",
    "--rejected", "Postgres: one more service"
  );
  expect(decision).toMatchObject({ title: "Use SQLite", status: "accepted", rejectedAlternatives: "Postgres: one more service" });
  const lesson = json("demo", "lesson", "add", "Migrations race", "--what-failed", "Two processes migrated", "--dont-repeat", "Retry", "--tags", "db");
  expect(lesson).toMatchObject({ title: "Migrations race", tags: "db" });
  expect(lesson.projectId).not.toBeNull();
  expect(json("demo", "lesson", "add", "Global", "--what-failed", "x", "--dont-repeat", "y", "--global").projectId).toBeNull();

  const pkg = json("demo", "work", "-c", "5");
  expect(pkg.decisions.map((d: { title: string }) => d.title)).toContain("Use SQLite");
  expect(pkg.lessons.map((l: { title: string }) => l.title)).toContain("Migrations race");
  expect(scrum("demo", "decision", "add", "No context", "--decision", "x").status).not.toBe(0);
});

test("session register uses a given ID or finds none without a transcript", () => {
  expect(json("session", "register", "--id", "abc-123")).toEqual({ registered: true, cwd: fs.realpathSync(tmp), session_id: "abc-123" });
  const none = spawnSync(process.execPath, [cli, "session", "register"], {
    cwd: tmp,
    env: { ...env(), HOME: tmp },
    encoding: "utf8",
  });
  expect(none.status).toBe(1);
  expect(none.stderr).toContain("No session ID");
});

test("the new command names cannot be used as project names", () => {
  for (const name of ["work", "session", "decision", "lesson"]) {
    expect(scrum("init", name).status).toBe(1);
  }
});
