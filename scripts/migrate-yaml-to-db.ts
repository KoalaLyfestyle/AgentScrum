/**
 * One-time migration: rebuilds agentscrum.db from the hardcoded Sprint 1+2 data
 * that previously lived in .issues.yaml.
 *
 * Safe to re-run — wipes all rows and re-inserts from scratch.
 * After running: .issues.yaml is deleted by this script.
 *
 * Usage: npx tsx scripts/migrate-yaml-to-db.ts
 */

import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env["SCRUM_DB_PATH"] ?? path.resolve(__dirname, "../agentscrum.db");
const migrationsFolder = path.resolve(__dirname, "../drizzle");
const issuesYamlPath = path.resolve(__dirname, "../.issues.yaml");

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = OFF"); // off during wipe

const db = drizzle(sqlite);

// Apply any pending migrations first
migrate(db, { migrationsFolder });

// ---------------------------------------------------------------------------
// Wipe all rows (FK order: deepest first)
// ---------------------------------------------------------------------------
sqlite.exec(`
  DELETE FROM sessions;
  DELETE FROM acceptance_criteria;
  DELETE FROM issues;
  DELETE FROM epics;
  DELETE FROM sprints;
  DELETE FROM projects;
  DELETE FROM sqlite_sequence WHERE name IN (
    'sessions','acceptance_criteria','issues','epics','sprints','projects'
  );
`);

sqlite.pragma("foreign_keys = ON");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function now(date?: string): string {
  return date ? new Date(date).toISOString() : new Date().toISOString();
}

function insertOne(table: string, row: Record<string, unknown>): number {
  const cols = Object.keys(row);
  const placeholders = cols.map(() => "?").join(", ");
  const stmt = sqlite.prepare(
    `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${placeholders})`
  );
  const result = stmt.run(...Object.values(row));
  return Number(result.lastInsertRowid);
}

// ---------------------------------------------------------------------------
// Project
// ---------------------------------------------------------------------------
const projectId = insertOne("projects", {
  name: "agentscrum",
  created_at: now("2026-04-09"),
});

// ---------------------------------------------------------------------------
// Sprint 1 (closed) — E1: Data Model + CLI
// ---------------------------------------------------------------------------
const sprint1Id = insertOne("sprints", {
  project_id: projectId,
  number: 1,
  status: "closed",
  goal: "Data model + CLI",
  started_at: now("2026-04-09"),
  closed_at: now("2026-04-09"),
});

// ---------------------------------------------------------------------------
// Sprint 2 (active) — E2: MCP Server
// ---------------------------------------------------------------------------
const sprint2Id = insertOne("sprints", {
  project_id: projectId,
  number: 2,
  status: "active",
  goal: "MCP server — full agent self-management",
  started_at: now("2026-04-09"),
  closed_at: null,
});

// ---------------------------------------------------------------------------
// Epic 1: Data Model + CLI
// ---------------------------------------------------------------------------
const epic1Id = insertOne("epics", {
  project_id: projectId,
  title: "Data Model + CLI",
  status: "complete",
  created_at: now("2026-04-09"),
});

// ---------------------------------------------------------------------------
// E1 Issues
// ---------------------------------------------------------------------------
const e1Issues: Array<{
  title: string;
  type: string;
  priority: string;
  acs: string[];
  session: { date: string; summary: string; auditor: string };
}> = [
  {
    title: "Define core schemas (Project, Epic, Sprint, Issue)",
    type: "feature",
    priority: "high",
    acs: [
      "TypeScript interfaces defined for Project, Epic, Sprint, Issue, Session",
      "Status enum covers todo | in_progress | review | done | blocked",
      "Type enum covers feature | bugfix | refactor | test | docs",
      "All fields nullable/optional where appropriate for partial updates",
    ],
    session: {
      date: "2026-04-09",
      summary:
        "Defined all interfaces and enums in src/schema/types.ts; added AcceptanceCriterion and SprintSummary composites; AuditorVerdict enum for full self-management scope",
      auditor: "skipped",
    },
  },
  {
    title: "SQLite schema + Drizzle migrations",
    type: "feature",
    priority: "high",
    acs: [
      "Drizzle ORM configured with SQLite",
      "Migration for all core tables (projects, epics, sprints, issues, sessions)",
      "`drizzle-kit generate` and `migrate` commands work cleanly",
      "DB path configurable via SCRUM_DB_PATH env var (default ./agentscrum.db)",
    ],
    session: {
      date: "2026-04-09",
      summary:
        "Created src/db/schema.ts (6 tables), src/db/index.ts (singleton + _resetDb for testing), src/db/migrate.ts, drizzle.config.ts; acceptance_criteria is a separate table to support scrum_complete_ac in Sprint 2",
      auditor: "skipped",
    },
  },
  {
    title: "CLI — scrum init",
    type: "feature",
    priority: "high",
    acs: [
      "Command: scrum init <project-name>",
      "Creates project record in DB",
      "Creates Sprint 1 automatically",
      "Outputs confirmation with project ID",
    ],
    session: {
      date: "2026-04-09",
      summary: "Implemented in src/cli/commands/init.ts; smoke-tested successfully",
      auditor: "skipped",
    },
  },
  {
    title: "CLI — scrum issue (CRUD)",
    type: "feature",
    priority: "high",
    acs: [
      "scrum issue add <epic-id> <title> — creates issue in current sprint",
      "scrum issue list — shows all issues in current sprint with status",
      "scrum issue status <issue-id> <status> — updates status",
      "scrum issue show <issue-id> — full detail including ACs and session history",
    ],
    session: {
      date: "2026-04-09",
      summary:
        "Implemented in src/cli/commands/issue.ts; also added scrum issue ac <id> <text> and scrum epic commands (required for issue creation); smoke-tested all commands",
      auditor: "skipped",
    },
  },
  {
    title: "CLI — scrum status",
    type: "feature",
    priority: "medium",
    acs: [
      "scrum status — prints current sprint summary",
      "Shows sprint number, total issues, breakdown by status",
      "Shows active (in_progress) issue if any",
      "Human-readable, scannable output",
    ],
    session: {
      date: "2026-04-09",
      summary: "Implemented in src/cli/commands/status.ts; smoke-tested successfully",
      auditor: "skipped",
    },
  },
  {
    title: "CLI — scrum log (session logging)",
    type: "feature",
    priority: "medium",
    acs: [
      "scrum log <issue-id> <summary> [--tokens N] — appends session entry",
      "Increments tokens_used on the issue",
      "Timestamps the entry",
      "Readable in scrum issue show output",
    ],
    session: {
      date: "2026-04-09",
      summary: "Implemented in src/cli/commands/log.ts; smoke-tested with --tokens and --auditor flags",
      auditor: "skipped",
    },
  },
];

for (const issue of e1Issues) {
  const issueId = insertOne("issues", {
    epic_id: epic1Id,
    sprint_id: sprint1Id,
    title: issue.title,
    type: issue.type,
    status: "done",
    priority: issue.priority,
    assigned_to: null,
    tokens_used: 0,
    created_at: now("2026-04-09"),
  });
  for (const acText of issue.acs) {
    insertOne("acceptance_criteria", {
      issue_id: issueId,
      text: acText,
      completed: 1,
      created_at: now("2026-04-09"),
    });
  }
  insertOne("sessions", {
    issue_id: issueId,
    date: issue.session.date,
    summary: issue.session.summary,
    tokens_used: 0,
    auditor: issue.session.auditor,
  });
}

// ---------------------------------------------------------------------------
// Epic 2: MCP Server
// ---------------------------------------------------------------------------
const epic2Id = insertOne("epics", {
  project_id: projectId,
  title: "MCP Server",
  status: "active",
  created_at: now("2026-04-09"),
});

// ---------------------------------------------------------------------------
// E2 Issues
// ---------------------------------------------------------------------------
const e2Issues: Array<{
  title: string;
  type: string;
  priority: string;
  acs: string[];
  session: { date: string; summary: string; auditor: string };
}> = [
  {
    title: "MCP server foundation",
    type: "feature",
    priority: "high",
    acs: [
      "@modelcontextprotocol/sdk installed",
      "src/mcp/server.ts created with McpServer + StdioServerTransport",
      "npm run mcp starts server without crash",
      "Server runs DB migrations on start if DB is empty",
      "SCRUM_DB_PATH and SCRUM_PROJECT_ID read from env",
    ],
    session: {
      date: "2026-04-09",
      summary:
        "Installed @modelcontextprotocol/sdk v1.29.0; created src/mcp/server.ts with McpServer + StdioServerTransport; runs migrations on start; added npm run mcp script",
      auditor: "skipped",
    },
  },
  {
    title: "MCP read tools (4 tools)",
    type: "feature",
    priority: "high",
    acs: [
      "scrum_get_current_sprint(project_id) returns sprint + issues + summary",
      "scrum_get_sprint_summary(sprint_id) returns SprintSummary",
      "scrum_get_issue_detail(issue_id) returns IssueDetail with ACs and sessions",
      "scrum_get_my_issues(project_id, agent_id) returns Issue[]",
      "All inputs validated with Zod schemas",
      "Errors returned as isError:true with descriptive message",
    ],
    session: {
      date: "2026-04-09",
      summary:
        "Implemented scrum_get_current_sprint, scrum_get_sprint_summary, scrum_get_issue_detail, scrum_get_my_issues; all Zod-validated; smoke-tested via stdio",
      auditor: "skipped",
    },
  },
  {
    title: "MCP write tools — project/sprint (5 tools)",
    type: "feature",
    priority: "high",
    acs: [
      "scrum_init_project(name) creates project + Sprint 1, runs migrations",
      "scrum_create_epic(project_id, title) creates epic",
      "scrum_create_sprint(project_id) creates next sprint in planning",
      "scrum_start_sprint(sprint_id, goal?) transitions to active",
      "scrum_close_sprint(sprint_id) transitions to closed",
      "All inputs Zod-validated",
    ],
    session: {
      date: "2026-04-09",
      summary:
        "Implemented scrum_init_project, scrum_create_epic, scrum_create_sprint, scrum_start_sprint, scrum_close_sprint; all Zod-validated",
      auditor: "skipped",
    },
  },
  {
    title: "MCP write tools — issue management (3 tools)",
    type: "feature",
    priority: "high",
    acs: [
      "scrum_create_issue(epic_id, sprint_id, title, type?, priority?) creates issue",
      "scrum_update_issue_status(issue_id, status) transitions status",
      "scrum_assign_issue(issue_id, agent_id) assigns issue to agent",
      "status and type validated against enums",
    ],
    session: {
      date: "2026-04-09",
      summary:
        "Implemented scrum_create_issue, scrum_update_issue_status, scrum_assign_issue; enum validation via Zod",
      auditor: "skipped",
    },
  },
  {
    title: "MCP write tools — AC + session (3 tools)",
    type: "feature",
    priority: "high",
    acs: [
      "scrum_add_ac(issue_id, text) adds acceptance criterion",
      "scrum_complete_ac(ac_id) marks AC done",
      "scrum_log_session(issue_id, summary, tokens_used?, auditor?) logs session",
      "scrum_log_session response includes updated tokens_used total",
      "auditor validated against pass|fail|skipped",
    ],
    session: {
      date: "2026-04-09",
      summary:
        "Implemented scrum_add_ac, scrum_complete_ac, scrum_log_session; log_session returns updated tokens_total",
      auditor: "skipped",
    },
  },
  {
    title: "Claude Code registration + dogfood test",
    type: "feature",
    priority: "medium",
    acs: [
      "claude mcp add agentscrum wires up the server",
      "scrum_get_current_sprint callable from Claude Code",
      "scrum_update_issue_status persists to DB when called from Claude Code",
      "scrum_log_session used to log this session against E2-I6",
    ],
    session: {
      date: "2026-04-09",
      summary:
        "Registered via `claude mcp add agentscrum`; server shows Connected; all 6 Sprint 2 issues marked done via MCP tool calls; session logged via scrum_log_session; 15 tools live in Claude Code session",
      auditor: "pass",
    },
  },
];

for (const issue of e2Issues) {
  const issueId = insertOne("issues", {
    epic_id: epic2Id,
    sprint_id: sprint2Id,
    title: issue.title,
    type: issue.type,
    status: "done",
    priority: issue.priority,
    assigned_to: null,
    tokens_used: 0,
    created_at: now("2026-04-09"),
  });
  for (const acText of issue.acs) {
    insertOne("acceptance_criteria", {
      issue_id: issueId,
      text: acText,
      completed: 1,
      created_at: now("2026-04-09"),
    });
  }
  insertOne("sessions", {
    issue_id: issueId,
    date: issue.session.date,
    summary: issue.session.summary,
    tokens_used: 0,
    auditor: issue.session.auditor,
  });
}

sqlite.close();

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
const counts = {
  projects: 1,
  sprints: 2,
  epics: 2,
  issues: e1Issues.length + e2Issues.length,
  acs: [...e1Issues, ...e2Issues].reduce((n, i) => n + i.acs.length, 0),
  sessions: e1Issues.length + e2Issues.length,
};

console.log("Migration complete:");
for (const [k, v] of Object.entries(counts)) {
  console.log(`  ${k}: ${v} rows inserted`);
}

// Delete .issues.yaml
if (fs.existsSync(issuesYamlPath)) {
  fs.unlinkSync(issuesYamlPath);
  console.log("\n.issues.yaml deleted.");
} else {
  console.log("\n.issues.yaml not found (already deleted).");
}
