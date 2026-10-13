#!/usr/bin/env node
// End-to-end MCP check over stdio, for the native server and the container.
//
//   node scripts/mcp-smoke.mjs -- <command that starts the MCP server> [args...]
//
// Examples:
//   SCRUM_DB_PATH=/tmp/smoke.db node scripts/mcp-smoke.mjs -- node dist/mcp/server.js
//   AGENTSCRUM_VOLUME=agentscrum-smoke node scripts/mcp-smoke.mjs -- bin/agentscrum-mcp
//
// It starts two server processes on the same database and:
//   1. creates a project, an epic, and an issue in the first sprint
//   2. has both clients claim the issue at the same moment: exactly one must win
//   3. moves the issue to in_progress, then done, and reads it back
//   4. fails if any stdout line from either server is not a JSON-RPC message
// Prints a JSON summary on stdout. Exit 0 on success, 1 on failure.
// It creates new rows; point it at a test database or volume, never a real one.
import { spawn } from "node:child_process";

const sep = process.argv.indexOf("--");
const command = sep === -1 ? [] : process.argv.slice(sep + 1);
if (command.length === 0) {
  process.stderr.write("usage: node scripts/mcp-smoke.mjs -- <mcp server command...>\n");
  process.exit(2);
}

const TIMEOUT_MS = Number(process.env.MCP_SMOKE_TIMEOUT_MS ?? 30000);

class Client {
  constructor(name) {
    this.name = name;
    this.nextId = 1;
    this.pending = new Map();
    this.badLines = [];
    this.stderr = "";
    this.proc = spawn(command[0], command.slice(1), { stdio: ["pipe", "pipe", "pipe"] });
    let buffer = "";
    this.proc.stdout.setEncoding("utf8");
    this.proc.stdout.on("data", (chunk) => {
      buffer += chunk;
      let nl;
      while ((nl = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, nl);
        buffer = buffer.slice(nl + 1);
        this.onLine(line);
      }
    });
    this.proc.stdout.on("end", () => {
      if (buffer.trim()) this.badLines.push(buffer);
    });
    this.proc.stderr.setEncoding("utf8");
    this.proc.stderr.on("data", (chunk) => (this.stderr += chunk));
    this.exited = new Promise((resolve) => this.proc.on("exit", (code) => resolve(code)));
    this.proc.on("exit", (code) => {
      for (const { reject } of this.pending.values()) {
        reject(new Error(`${this.name}: server exited with ${code}. stderr: ${this.stderr.trim()}`));
      }
      this.pending.clear();
    });
  }

  onLine(line) {
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      this.badLines.push(line);
      return;
    }
    if (msg?.jsonrpc !== "2.0") {
      this.badLines.push(line);
      return;
    }
    if (msg.id !== undefined && this.pending.has(msg.id)) {
      const { resolve } = this.pending.get(msg.id);
      this.pending.delete(msg.id);
      resolve(msg);
    }
  }

  request(method, params) {
    const id = this.nextId++;
    const message = JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n";
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${this.name}: ${method} timed out. stderr: ${this.stderr.trim()}`));
      }, TIMEOUT_MS);
      this.pending.set(id, {
        resolve: (msg) => {
          clearTimeout(timer);
          resolve(msg);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        },
      });
      this.proc.stdin.write(message);
    });
  }

  notify(method, params) {
    this.proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
  }

  async initialize() {
    const res = await this.request("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "agentscrum-smoke", version: "1" },
    });
    if (res.error) throw new Error(`${this.name}: initialize failed: ${JSON.stringify(res.error)}`);
    this.notify("notifications/initialized", {});
    return res.result;
  }

  /** Call a tool; returns { ok, data, text }. */
  async call(name, args) {
    const res = await this.request("tools/call", { name, arguments: args });
    if (res.error) throw new Error(`${this.name}: ${name} protocol error: ${JSON.stringify(res.error)}`);
    const text = res.result?.content?.[0]?.text ?? "";
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = undefined;
    }
    return { ok: !res.result?.isError, data, text };
  }

  async must(name, args) {
    const r = await this.call(name, args);
    if (!r.ok) throw new Error(`${this.name}: ${name} failed: ${r.text}`);
    return r.data;
  }

  async close() {
    this.proc.stdin.end();
    const code = await Promise.race([
      this.exited,
      new Promise((resolve) => setTimeout(() => resolve("timeout"), 5000)),
    ]);
    if (code === "timeout") this.proc.kill("SIGKILL");
  }
}

async function main() {
  const a = new Client("client-a");
  const b = new Client("client-b");
  const summary = { ok: false };
  try {
    await Promise.all([a.initialize(), b.initialize()]);
    const tools = await a.request("tools/list", {});
    summary.tools = tools.result?.tools?.length ?? 0;

    const name = `smoke-${Date.now()}-${process.pid}`;
    const { project, sprint } = await a.must("scrum_init_project", { name });
    const epic = await a.must("scrum_create_epic", { project_id: project.id, title: "Smoke" });
    const issue = await a.must("scrum_create_issue", {
      epic_id: epic.id,
      sprint_id: sprint.id,
      title: "Smoke test issue",
    });

    // Both claim at the same moment, from separate processes.
    const [ra, rb] = await Promise.all([
      a.call("scrum_assign_issue", { issue_id: issue.id, agent_id: "agent-a" }),
      b.call("scrum_assign_issue", { issue_id: issue.id, agent_id: "agent-b" }),
    ]);
    const winners = [ra, rb].filter((r) => r.ok);
    summary.claim = { a: ra.ok ? "won" : ra.text, b: rb.ok ? "won" : rb.text };
    if (winners.length !== 1) throw new Error(`expected exactly one claim to succeed, got ${winners.length}`);
    const winner = ra.ok ? a : b;

    await winner.must("scrum_update_issue_status", { issue_id: issue.id, status: "in_progress" });
    await winner.must("scrum_update_issue_status", { issue_id: issue.id, status: "done" });
    const detail = await b.must("scrum_get_issue_detail", { issue_id: issue.id });
    const status = detail?.issue?.status ?? detail?.status;
    if (status !== "done") throw new Error(`issue status is ${status}, expected done`);

    summary.project = { id: project.id, name };
    summary.issue = { id: issue.id, status, assignedTo: detail?.issue?.assignedTo ?? detail?.assignedTo };
  } catch (err) {
    summary.error = err instanceof Error ? err.message : String(err);
  } finally {
    await Promise.all([a.close(), b.close()]);
  }
  summary.badStdoutLines = [...a.badLines, ...b.badLines];
  summary.ok = !summary.error && summary.badStdoutLines.length === 0;
  process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
  process.exit(summary.ok ? 0 : 1);
}

await main();
