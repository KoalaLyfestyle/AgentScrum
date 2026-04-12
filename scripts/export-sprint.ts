/**
 * Zero-token SQLite → Obsidian export.
 * Reads the DB and writes markdown files to the Obsidian vault.
 *
 * Usage:
 *   npx tsx scripts/export-sprint.ts --sprint <N> [--project <id>]
 *
 * Env:
 *   SCRUM_DB_PATH        — SQLite path (default: ./agentscrum.db)
 *   OBSIDIAN_VAULT_PATH  — vault root (default: ~/Orion/Claude-Workspace)
 *
 * Writes:
 *   <vault>/projects/agentscrum/sprints/sprint-N.md
 *   <vault>/projects/agentscrum/decisions/<id>-<slug>.md  (all for the project)
 *   <vault>/projects/agentscrum/lessons/<id>-<slug>.md    (all for the project)
 *
 * Run manually at sprint close. No automation, no tokens.
 */

import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const sprintArg = args.find((_, i) => args[i - 1] === "--sprint");
const projectArg = args.find((_, i) => args[i - 1] === "--project");

if (!sprintArg) {
  console.error("Usage: npx tsx scripts/export-sprint.ts --sprint <N> [--project <id>]");
  process.exit(1);
}

const sprintNumber = parseInt(sprintArg, 10);
const projectId = projectArg ? parseInt(projectArg, 10) : 1;

const dbPath = process.env["SCRUM_DB_PATH"] ?? path.resolve(__dirname, "../agentscrum.db");
const vaultRoot = process.env["OBSIDIAN_VAULT_PATH"] ?? path.join(os.homedir(), "Orion/Claude-Workspace");

// ---------------------------------------------------------------------------
// DB
// ---------------------------------------------------------------------------
const db = new Database(dbPath, { readonly: true });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function slug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return iso.slice(0, 10);
}

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function write(filePath: string, content: string): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, "utf8");
  console.log(`  wrote: ${filePath.replace(os.homedir(), "~")}`);
}

// ---------------------------------------------------------------------------
// Sprint export
// ---------------------------------------------------------------------------
const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(projectId) as
  | { id: number; name: string; created_at: string }
  | undefined;
if (!project) {
  console.error(`Project ${projectId} not found`);
  process.exit(1);
}

const projectSlug = project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const sprint = db
  .prepare("SELECT * FROM sprints WHERE project_id = ? AND number = ?")
  .get(projectId, sprintNumber) as
  | { id: number; number: number; status: string; goal: string | null; started_at: string | null; closed_at: string | null }
  | undefined;
if (!sprint) {
  console.error(`Sprint ${sprintNumber} not found for project ${projectId}`);
  process.exit(1);
}

const issues = db
  .prepare(`
    SELECT i.*, e.title as epic_title
    FROM issues i
    JOIN epics e ON e.id = i.epic_id
    WHERE i.sprint_id = ?
    ORDER BY i.id
  `)
  .all(sprint.id) as Array<{
  id: number;
  title: string;
  status: string;
  priority: string;
  type: string;
  tokens_used: number;
  epic_title: string;
}>;

const issueRows = issues
  .map((i) => `| ${i.id} | ${i.title} | ${i.status} | ${i.priority} | ${i.tokens_used} |`)
  .join("\n");

// Session log
const sessionSections = issues
  .map((issue) => {
    const sessions = db
      .prepare("SELECT * FROM sessions WHERE issue_id = ? ORDER BY date")
      .all(issue.id) as Array<{ date: string; summary: string; tokens_used: number; auditor: string | null }>;

    const acs = db
      .prepare("SELECT * FROM acceptance_criteria WHERE issue_id = ? ORDER BY id")
      .all(issue.id) as Array<{ text: string; completed: number }>;

    if (sessions.length === 0) return "";

    const acLines = acs.map((a) => `  - [${a.completed ? "x" : " "}] ${a.text}`).join("\n");
    const sessionLines = sessions
      .map((s) => {
        const verdict = s.auditor ? ` [${s.auditor.toUpperCase()}]` : "";
        const tokens = s.tokens_used > 0 ? ` _(${s.tokens_used} tokens)_` : "";
        return `- **${s.date}**${verdict}${tokens}: ${s.summary}`;
      })
      .join("\n");

    return `### ${issue.id}: ${issue.title}\n\n**ACs:**\n${acLines}\n\n**Sessions:**\n${sessionLines}`;
  })
  .filter(Boolean)
  .join("\n\n---\n\n");

const sprintMd = `---
sprint: ${sprint.number}
status: ${sprint.status}
project: ${project.name}
started: ${formatDate(sprint.started_at)}
closed: ${formatDate(sprint.closed_at)}
exported: ${new Date().toISOString().slice(0, 10)}
---

# Sprint ${sprint.number} — ${sprint.status.toUpperCase()}

${sprint.goal ? `**Goal:** ${sprint.goal}\n` : ""}**Dates:** ${formatDate(sprint.started_at)} → ${formatDate(sprint.closed_at)}

## Issues

| ID | Title | Status | Priority | Tokens |
|----|-------|--------|----------|--------|
${issueRows}

**Total:** ${issues.length} issues

## Session Log

${sessionSections || "_No sessions logged._"}
`;

const sprintDir = path.join(vaultRoot, "projects", projectSlug, "sprints");
write(path.join(sprintDir, `sprint-${sprint.number}.md`), sprintMd);

// ---------------------------------------------------------------------------
// Decisions export
// ---------------------------------------------------------------------------
const decisions = db
  .prepare("SELECT * FROM decisions WHERE project_id = ? ORDER BY id")
  .all(projectId) as Array<{
  id: number;
  title: string;
  status: string;
  context: string;
  decision: string;
  rejected_alternatives: string | null;
  consequences: string | null;
  created_at: string;
}>;

const decisionsDir = path.join(vaultRoot, "projects", projectSlug, "decisions");
for (const d of decisions) {
  const md = `---
id: ${d.id}
title: "${d.title}"
status: ${d.status}
project: ${project.name}
created: ${formatDate(d.created_at)}
tags: [decision, adr]
---

# ${d.title}

**Status:** ${d.status}

## Context
${d.context}

## Decision
${d.decision}
${d.rejected_alternatives ? `\n## Rejected Alternatives\n${d.rejected_alternatives}` : ""}
${d.consequences ? `\n## Consequences\n${d.consequences}` : ""}
`;
  write(path.join(decisionsDir, `${d.id}-${slug(d.title)}.md`), md);
}
if (decisions.length === 0) console.log("  (no decisions to export)");

// ---------------------------------------------------------------------------
// Lessons export
// ---------------------------------------------------------------------------
const lessons = db
  .prepare("SELECT * FROM lessons WHERE project_id = ? ORDER BY id")
  .all(projectId) as Array<{
  id: number;
  title: string;
  what_failed: string;
  dont_repeat: string;
  tags: string | null;
  created_at: string;
}>;

const lessonsDir = path.join(vaultRoot, "projects", projectSlug, "lessons");
for (const l of lessons) {
  const tagList = l.tags ? l.tags.split(",").map((t) => t.trim()) : [];
  const md = `---
id: ${l.id}
title: "${l.title}"
project: ${project.name}
created: ${formatDate(l.created_at)}
tags: [${["lesson", ...tagList].join(", ")}]
---

# ${l.title}

## What Failed
${l.what_failed}

## Don't Repeat
> ${l.dont_repeat}
${tagList.length > 0 ? `\n**Tags:** ${tagList.join(", ")}` : ""}
`;
  write(path.join(lessonsDir, `${l.id}-${slug(l.title)}.md`), md);
}
if (lessons.length === 0) console.log("  (no lessons to export)");

db.close();
console.log(`\nExport complete — Sprint ${sprintNumber} → ${vaultRoot.replace(os.homedir(), "~")}`);
