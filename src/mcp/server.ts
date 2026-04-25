#!/usr/bin/env node
/**
 * AgentScrum MCP Server
 *
 * Exposes all Scrum operations as MCP tools so any agent can manage
 * a full sprint lifecycle without reading YAML or needing a human PM.
 *
 * Environment:
 *   SCRUM_DB_PATH     — SQLite file path (default: ./agentscrum.db)
 *   SCRUM_PROJECT_ID  — default project ID for tools that omit project_id
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { fileURLToPath } from "url";
import path from "path";
import { readdirSync, statSync } from "fs";
import { homedir } from "os";

import { getDb } from "../db/index.js";
import * as scrum from "../services/scrum.js";

// Session registry: cwd → CC session ID.
// Populated by the agent calling scrum_register_session at PM phase start.
// Required for COST_SOURCE=transcript — used to attribute tokens to issues.
const sessionRegistry = new Map<string, string>();

const COST_SOURCE_MODE = process.env["COST_SOURCE"] ?? "manual";

const COST_TRACKING_SUFFIX =
  "\n\nCOST TRACKING: Call this tool before starting work on an issue and after finishing, " +
  "respectively, so that token usage is attributed to the correct issue. " +
  "The cost window opens at assign (sets claimed_at) and closes at release or terminal status change (sets released_at). " +
  `Current mode: COST_SOURCE=${COST_SOURCE_MODE}`;

const ASSIGN_BASE_DESCRIPTION =
  "Assign an issue to an agent and atomically claim it to prevent concurrent pickup by other agents. " +
  "Returns an error (not a crash) if the issue is already claimed by a different agent and the claim is still fresh (<30 min). " +
  "Use the agent's identifier (e.g. 'pm', 'builder', 'auditor').";

const RELEASE_BASE_DESCRIPTION =
  "Explicitly release an issue claim so other agents can pick it up. " +
  "Call this when abandoning an issue or handing off work. " +
  "Optionally pass agent_id to enforce that only the claiming agent can release.";

/**
 * Auto-discover the current Claude Code session ID from the transcript directory.
 * CC writes JSONL transcripts to ~/.claude/projects/<cwd-with-slashes-as-hyphens>/.
 * The most recently modified .jsonl file is the current session.
 */
export function discoverSessionId(cwd: string, projectsBaseDir?: string): string | undefined {
  try {
    const encoded = cwd.replace(/[/\\]/g, "-");
    const base = projectsBaseDir ?? path.join(homedir(), ".claude", "projects");
    const projectDir = path.join(base, encoded);
    const files = readdirSync(projectDir)
      .filter((f) => f.endsWith(".jsonl"))
      .map((f) => ({ name: f, mtime: statSync(path.join(projectDir, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);
    if (files.length === 0) return undefined;
    return files[0]!.name.replace(/\.jsonl$/, "");
  } catch {
    return undefined;
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Trigger DB initialization (migrations run inside getDb() on first call)
getDb();

const server = new McpServer({ name: "agentscrum", version: "0.1.0" });

// Helper: wrap handler to catch errors and return them as isError responses
async function safe<T>(
  fn: () => T | Promise<T>
): Promise<{ content: [{ type: "text"; text: string }]; isError?: boolean }> {
  try {
    const result = await fn();
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    return {
      content: [{ type: "text", text: err instanceof Error ? err.message : String(err) }],
      isError: true,
    };
  }
}

// ---------------------------------------------------------------------------
// READ TOOLS
// ---------------------------------------------------------------------------

server.registerTool(
  "scrum_get_current_sprint",
  {
    description:
      "Get the active (or planning) sprint for a project, including all issues and a status summary. This is the primary tool for an agent to orient at the start of a session.",
    inputSchema: {
      project_id: z.number().int().describe("Project ID"),
    },
  },
  (args) =>
    safe(() => {
      const sprint = scrum.getActiveSprint(args.project_id);
      const issues = scrum.listIssues(sprint.id);
      const summary = scrum.getSprintSummary(sprint.id);
      return { sprint, issues, summary: { total: summary.total, byStatus: summary.byStatus } };
    })
);

server.registerTool(
  "scrum_get_issue_detail",
  {
    description:
      "Get full issue detail including all acceptance criteria (with completion state) and session history.",
    inputSchema: {
      issue_id: z.number().int().describe("Issue ID"),
    },
  },
  (args) => safe(() => scrum.getIssueDetail(args.issue_id))
);


server.registerTool(
  "scrum_get_retrospective",
  {
    description:
      "Get a sprint retrospective summary: blocked issues (with reasons), done issues with incomplete ACs, and high-token issues. Omit sprint_number to query the last closed sprint.",
    inputSchema: {
      project_id: z.number().int().describe("Project ID"),
      sprint_number: z.number().int().optional().describe("Sprint number (default: last closed sprint)"),
    },
  },
  (args) => safe(() => scrum.getRetrospective(args.project_id, args.sprint_number))
);

server.registerTool(
  "scrum_get_velocity",
  {
    description:
      "Get velocity data for all closed sprints: story points completed, issues completed, and total tokens used per sprint. Includes per-agent token breakdown when issues have assigned_to set.",
    inputSchema: {
      project_id: z.number().int().describe("Project ID"),
    },
  },
  (args) => safe(() => scrum.getVelocity(args.project_id))
);

server.registerTool(
  "scrum_get_cost_report",
  {
    description:
      "Cost report for a sprint: tokens used and estimated USD cost per issue and sprint total. Requires SCRUM_MODEL_PRICES env var (JSON: model → $/1M tokens) for dollar figures; returns tokens-only when not set. Omit sprint_number for the active sprint.",
    inputSchema: {
      project_id: z.number().int().describe("Project ID"),
      sprint_number: z.number().int().optional().describe("Sprint number (default: active sprint)"),
    },
  },
  (args) => safe(() => scrum.getCostReport(args.project_id, args.sprint_number))
);

// ---------------------------------------------------------------------------
// WRITE TOOLS — Project / Sprint lifecycle
// ---------------------------------------------------------------------------

server.registerTool(
  "scrum_init_project",
  {
    description:
      "Create a new project with Sprint 1 in planning status. Returns the project and sprint IDs needed for subsequent tool calls.",
    inputSchema: {
      name: z.string().describe("Project name"),
    },
  },
  (args) => safe(() => scrum.initProject(args.name))
);

server.registerTool(
  "scrum_create_epic",
  {
    description: "Create a new epic within a project.",
    inputSchema: {
      project_id: z.number().int().describe("Project ID"),
      title: z.string().describe("Epic title"),
    },
  },
  (args) => safe(() => scrum.createEpic(args.project_id, args.title))
);

server.registerTool(
  "scrum_create_sprint",
  {
    description: "Create the next sprint (in planning status) for a project.",
    inputSchema: {
      project_id: z.number().int().describe("Project ID"),
    },
  },
  (args) => safe(() => scrum.createSprint(args.project_id))
);

server.registerTool(
  "scrum_start_sprint",
  {
    description: "Transition a sprint from planning → active. Optionally set a sprint goal.",
    inputSchema: {
      sprint_id: z.number().int().describe("Sprint ID"),
      goal: z.string().optional().describe("Sprint goal (optional)"),
    },
  },
  (args) => safe(() => scrum.startSprint(args.sprint_id, args.goal))
);

server.registerTool(
  "scrum_close_sprint",
  {
    description: "Transition a sprint from active → closed.",
    inputSchema: {
      sprint_id: z.number().int().describe("Sprint ID"),
    },
  },
  (args) => safe(() => scrum.closeSprint(args.sprint_id))
);

// ---------------------------------------------------------------------------
// WRITE TOOLS — Issue management
// ---------------------------------------------------------------------------

server.registerTool(
  "scrum_create_issue",
  {
    description: "Create a new issue. Omit sprint_id to create an unassigned issue; supply sprint_id to assign it directly to a sprint.",
    inputSchema: {
      epic_id: z.number().int().describe("Epic ID the issue belongs to"),
      sprint_id: z.number().int().optional().describe("Sprint ID to add the issue to"),
      title: z.string().describe("Issue title"),
      description: z.string().optional().describe("Requirements body — what to build and why. Include constraints and scope. This is what the builder reads before starting."),
      type: z
        .enum(["feature", "bugfix", "refactor", "test", "docs"])
        .optional()
        .default("feature")
        .describe("Issue type"),
      priority: z
        .enum(["high", "medium", "low"])
        .optional()
        .default("medium")
        .describe("Priority"),
      story_points: z.number().int().min(1).max(13).optional().describe("Complexity estimate (Fibonacci: 1, 2, 3, 5, 8, 13)"),
    },
  },
  (args) =>
    safe(() => scrum.createIssue(args.epic_id, args.sprint_id ?? null, args.title, args.type, args.priority, args.description, args.story_points))
);

server.registerTool(
  "scrum_update_issue_status",
  {
    description: "Transition an issue to a new status.",
    inputSchema: {
      issue_id: z.number().int().describe("Issue ID"),
      status: z
        .enum(["todo", "in_progress", "review", "done", "blocked"])
        .describe("New status"),
      blocker_reason: z.string().optional().describe("Required when status=blocked: describe why the issue is blocked"),
    },
  },
  (args) =>
    safe(() => {
      if (args.status === "blocked" && !args.blocker_reason?.trim()) {
        throw new Error("blocker_reason is required when status=blocked");
      }
      return scrum.updateIssueStatus(args.issue_id, args.status, args.blocker_reason);
    })
);

server.registerTool(
  "scrum_assign_issue",
  {
    description: ASSIGN_BASE_DESCRIPTION + (COST_SOURCE_MODE !== "off" ? COST_TRACKING_SUFFIX : ""),
    inputSchema: {
      issue_id: z.number().int().describe("Issue ID"),
      agent_id: z.string().describe("Agent identifier"),
    },
  },
  (args) =>
    safe(() => {
      const sessionId = sessionRegistry.get(process.cwd()) ?? undefined;
      return scrum.assignIssue(args.issue_id, args.agent_id, sessionId);
    })
);

server.registerTool(
  "scrum_release_issue",
  {
    description: RELEASE_BASE_DESCRIPTION + (COST_SOURCE_MODE !== "off" ? COST_TRACKING_SUFFIX : ""),
    inputSchema: {
      issue_id: z.number().int().describe("Issue ID"),
      agent_id: z.string().optional().describe("Releasing agent's ID (optional — used to enforce ownership)"),
    },
  },
  (args) => safe(() => scrum.releaseIssue(args.issue_id, args.agent_id))
);

// ---------------------------------------------------------------------------
// WRITE TOOLS — Acceptance criteria + sessions
// ---------------------------------------------------------------------------

server.registerTool(
  "scrum_add_ac",
  {
    description: "Add an acceptance criterion to an issue.",
    inputSchema: {
      issue_id: z.number().int().describe("Issue ID"),
      text: z.string().describe("Acceptance criterion text"),
    },
  },
  (args) => safe(() => scrum.addAc(args.issue_id, args.text))
);

server.registerTool(
  "scrum_complete_ac",
  {
    description: "Mark an acceptance criterion as completed.",
    inputSchema: {
      ac_id: z.number().int().describe("Acceptance criterion ID"),
    },
  },
  (args) => safe(() => scrum.completeAc(args.ac_id))
);

server.registerTool(
  "scrum_log_session",
  {
    description:
      "Append a session log entry to an issue. Call this at the end of every work session to record what was done, tokens used, and auditor verdict. Increments the issue's total tokens_used.",
    inputSchema: {
      issue_id: z.number().int().describe("Issue ID"),
      summary: z.string().describe("What was done in this session"),
      tokens_used: z.number().int().min(0).optional().default(0).describe("Tokens used"),
      auditor: z
        .enum(["pass", "fail", "skipped"])
        .optional()
        .describe("Auditor verdict (omit if not yet audited)"),
      model: z.string().optional().describe("Model used in this session (e.g. claude-sonnet-4-6)"),
    },
  },
  async (args) =>
    safe(async () => {
      const session = await scrum.logSession(
        args.issue_id,
        args.summary,
        args.tokens_used,
        args.auditor,
        args.model
      );
      const detail = scrum.getIssueDetail(args.issue_id);
      return { session, issue_tokens_total: detail.tokensUsed };
    })
);

// ---------------------------------------------------------------------------
// PLANNING TOOLS — story points + work package
// ---------------------------------------------------------------------------


server.registerTool(
  "scrum_get_work_package",
  {
    description:
      "Get a fully-briefed work package for this session. Pass your capacity in story points — e.g. 5 for a short session, 20 for a full context window. Returns todo issues sorted by priority up to capacity, each with title, description, ACs, and story points embedded. No follow-up reads needed. Also returns the project DoD checklist to complete after each issue. Conventions: epics are long-lived feature areas — reuse existing ones rather than creating new epics for each sprint. Issues should be completable in one session; split anything over 8pt. Adjust capacity honestly to match your context window — do not over-commit. When blocking an issue always supply a blocker_reason so retrospectives are useful.",
    inputSchema: {
      project_id: z.number().int().describe("Project ID"),
      capacity: z.number().int().min(1).describe("Story points available this session"),
      agent_id: z.string().optional().describe("Calling agent's ID — used to include self-claimed issues and exclude issues claimed by other agents"),
    },
  },
  (args) => safe(() => scrum.getWorkPackage(args.project_id, args.capacity, args.agent_id))
);

server.registerTool(
  "scrum_register_session",
  {
    description:
      "Register the Claude Code session ID for cost attribution. Call once at the start of each PM phase. " +
      "If session_id is omitted, the server auto-discovers it from the most recent JSONL transcript in " +
      "~/.claude/projects/<cwd-with-slashes-as-hyphens>/. " +
      "The session ID is used by COST_SOURCE=transcript to attribute token usage to issues via claim windows.",
    inputSchema: {
      session_id: z.string().min(1).optional().describe(
        "Claude Code session ID (UUID). If omitted, auto-discovered from transcript directory."
      ),
    },
  },
  (args) =>
    safe(() => {
      const dir = process.cwd();
      const sessionId = args.session_id ?? discoverSessionId(dir);
      if (!sessionId) {
        throw new Error("No session ID provided and none discoverable from transcript directory");
      }
      sessionRegistry.set(dir, sessionId);
      return { registered: true, cwd: dir, session_id: sessionId };
    })
);

// ---------------------------------------------------------------------------
// DOD TOOLS — project-level Definition of Done
// ---------------------------------------------------------------------------

server.registerTool(
  "scrum_set_dod",
  {
    description:
      "Replace the entire Definition of Done checklist for a project. Use during project setup or when the DoD changes. Items are ordered as provided. Agents see this list in every work package.",
    inputSchema: {
      project_id: z.number().int().describe("Project ID"),
      items: z.array(z.string()).describe("Ordered list of DoD steps, e.g. ['Run npm test', 'Commit', 'Push']"),
    },
  },
  (args) => safe(() => scrum.setDod(args.project_id, args.items))
);

server.registerTool(
  "scrum_add_dod_item",
  {
    description: "Append a single item to the project Definition of Done checklist.",
    inputSchema: {
      project_id: z.number().int().describe("Project ID"),
      text: z.string().describe("DoD step text"),
      order: z.number().int().optional().describe("Position (0-indexed). Appends to end if omitted."),
    },
  },
  (args) => safe(() => scrum.addDodItem(args.project_id, args.text, args.order))
);

server.registerTool(
  "scrum_complete_dod_item",
  {
    description:
      "Mark a DoD item as completed for the specified sprint. Call this as each DoD checklist item is satisfied — work_package shows [x]/[ ] per sprint. Idempotent: safe to call twice.",
    inputSchema: {
      sprint_id: z.number().int().describe("Sprint ID"),
      dod_item_id: z.number().int().describe("DoD item ID (from the dod array in scrum_get_work_package)"),
    },
  },
  (args) => safe(() => scrum.completeDodItem(args.sprint_id, args.dod_item_id))
);

// ---------------------------------------------------------------------------
// EDIT TOOLS — update sprint / issue after creation
// ---------------------------------------------------------------------------

server.registerTool(
  "scrum_update_epic",
  {
    description: "Rename an epic. Epics are thematic categories (e.g. 'CLI', 'MCP Server') that remain open indefinitely — they have no status.",
    inputSchema: {
      epic_id: z.number().int().describe("Epic ID"),
      title: z.string().describe("New epic title"),
    },
  },
  (args) => safe(() => scrum.updateEpic(args.epic_id, { title: args.title }))
);

server.registerTool(
  "scrum_update_sprint",
  {
    description:
      "Update a sprint's title, goal, PR title, or PR description. Any combination of fields can be set. Use during or after sprint planning.",
    inputSchema: {
      sprint_id: z.number().int().describe("Sprint ID"),
      title: z.string().optional().describe("Human-readable sprint name, e.g. 'Cleanup & Polish'"),
      goal: z.string().optional().describe("Sprint goal — what we're trying to achieve"),
      pr_title: z.string().optional().describe("PR title to use when merging the sprint branch"),
      pr_description: z.string().optional().describe("PR description / merge commit body"),
    },
  },
  (args) => {
    const patch: Parameters<typeof scrum.updateSprint>[1] = {};
    if (args.title !== undefined) patch.title = args.title;
    if (args.goal !== undefined) patch.goal = args.goal;
    if (args.pr_title !== undefined) patch.prTitle = args.pr_title;
    if (args.pr_description !== undefined) patch.prDescription = args.pr_description;
    if (Object.keys(patch).length === 0) {
      return { content: [{ type: "text" as const, text: "Specify at least one field to update" }], isError: true };
    }
    return safe(() => scrum.updateSprint(args.sprint_id, patch));
  }
);

server.registerTool(
  "scrum_update_issue",
  {
    description:
      "Edit an issue after creation. Update title, description, priority, type, or story point estimate. At least one field must be provided.",
    inputSchema: {
      issue_id: z.number().int().describe("Issue ID"),
      title: z.string().optional().describe("New title"),
      description: z.string().optional().describe("New requirements body"),
      priority: z.enum(["high", "medium", "low"]).optional().describe("New priority"),
      type: z.enum(["feature", "bugfix", "refactor", "test", "docs"]).optional().describe("New type"),
      story_points: z.number().int().min(1).max(13).optional().describe("New story point estimate"),
    },
  },
  (args) => {
    const patch: Parameters<typeof scrum.updateIssue>[1] = {};
    if (args.title !== undefined) patch.title = args.title;
    if (args.description !== undefined) patch.description = args.description;
    if (args.priority !== undefined) patch.priority = args.priority;
    if (args.type !== undefined) patch.type = args.type;
    if (args.story_points !== undefined) patch.storyPoints = args.story_points;
    if (Object.keys(patch).length === 0) {
      return { content: [{ type: "text" as const, text: "Specify at least one field to update" }], isError: true };
    }
    return safe(() => scrum.updateIssue(args.issue_id, patch));
  }
);

// ---------------------------------------------------------------------------
// KNOWLEDGE TOOLS — decisions + lessons
// ---------------------------------------------------------------------------

server.registerTool(
  "scrum_log_decision",
  {
    description:
      "Record an architectural or approach decision (ADR-lite). Log when choosing X over Y so future agents don't relitigate the same question. Include rejected_alternatives.",
    inputSchema: {
      project_id: z.number().int().describe("Project ID"),
      title: z.string().describe("Short decision title, e.g. 'Use SQLite over MongoDB'"),
      context: z.string().describe("Why this decision was needed"),
      decision: z.string().describe("What was decided"),
      rejected_alternatives: z.string().optional().describe("What was considered and rejected, and why"),
      consequences: z.string().optional().describe("Known trade-offs or follow-on implications"),
    },
  },
  (args) =>
    safe(() =>
      scrum.logDecision({
        projectId: args.project_id,
        title: args.title,
        context: args.context,
        decision: args.decision,
        rejectedAlternatives: args.rejected_alternatives,
        consequences: args.consequences,
      })
    )
);

server.registerTool(
  "scrum_log_lesson",
  {
    description:
      "Record a hard-learned lesson or failure post-mortem. Log immediately when something breaks or a wrong approach is discovered. The dont_repeat field is read by future agents before starting similar work.",
    inputSchema: {
      title: z.string().describe("Short lesson title"),
      what_failed: z.string().describe("What went wrong and how it manifested"),
      dont_repeat: z.string().describe("Concrete instruction: what NOT to do next time"),
      project_id: z.number().int().optional().describe("Project ID (omit for cross-project lessons)"),
      tags: z.string().optional().describe("Comma-separated tags, e.g. 'drizzle,typescript,migration'"),
    },
  },
  (args) =>
    safe(() =>
      scrum.logLesson({
        projectId: args.project_id,
        title: args.title,
        whatFailed: args.what_failed,
        dontRepeat: args.dont_repeat,
        tags: args.tags,
      })
    )
);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

const transport = new StdioServerTransport();
await server.connect(transport);
