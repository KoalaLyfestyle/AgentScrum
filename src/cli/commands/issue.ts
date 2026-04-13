import { readSync } from "fs";
import type { Command } from "commander";
import {
  createIssue,
  listIssues,
  listEpics,
  updateIssue,
  updateIssueStatus,
  getIssueDetail,
  getSprintByNumber,
  listSprints,
  getIssuesByProject,
  addAc,
  epicKey,
  issueKey,
} from "../../services/scrum.js";
import type { Issue, IssueDetail, IssueStatus, IssueType, Priority } from "../../schema/types.js";
import { requireProjectId } from "../projectContext.js";

const ISSUE_STATUSES: IssueStatus[] = ["todo", "in_progress", "review", "done", "blocked"];
const ISSUE_TYPES: IssueType[] = ["feature", "bugfix", "refactor", "test", "docs"];
const PRIORITIES: Priority[] = ["high", "medium", "low"];

export function registerIssue(program: Command): void {
  const issue = program.command("issue").description("Manage issues");

  issue
    .command("add <epic-id> <title>")
    .description("Create a new issue. Omit --sprint to create unassigned; use --sprint <N> to assign to a sprint.")
    .option("-t, --type <type>", `Issue type (${ISSUE_TYPES.join("|")})`, "feature")
    .option("-p, --priority <priority>", `Priority (${PRIORITIES.join("|")})`, "medium")
    .option("-d, --description <text>", "Requirements body — what to build and why")
    .option("--points <n>", "Story point estimate (Fibonacci: 1, 2, 3, 5, 8, 13)")
    .option("--sprint <n>", "Sprint number to assign the issue to")
    .action((epicId: string, title: string, opts: { type: string; priority: string; description?: string; points?: string; sprint?: string }) => {
      try {
        const type = opts.type as IssueType;
        const priority = opts.priority as Priority;
        if (!ISSUE_TYPES.includes(type)) {
          console.error(`Invalid type: ${type}. Must be one of: ${ISSUE_TYPES.join(", ")}`);
          process.exit(1);
        }
        if (!PRIORITIES.includes(priority)) {
          console.error(`Invalid priority: ${priority}. Must be one of: ${PRIORITIES.join(", ")}`);
          process.exit(1);
        }
        const storyPoints = opts.points ? parseInt(opts.points, 10) : undefined;
        const pid = requireProjectId();

        let sprintId: number | null = null;
        let sprintNumber: number | null = null;
        if (opts.sprint !== undefined) {
          const n = parseInt(opts.sprint, 10);
          if (Number.isNaN(n)) throw new Error(`Invalid sprint number: "${opts.sprint}"`);
          const sprint = getSprintByNumber(pid, n);
          sprintId = sprint.id;
          sprintNumber = sprint.number;
        }

        const created = createIssue(parseInt(epicId, 10), sprintId, title, type, priority, opts.description, storyPoints);
        const epics = listEpics(pid);
        const epic = epics.find((e) => e.id === created.epicId);
        const key = epic ? issueKey(epic.number, created.number) : `#${created.id}`;
        const epicLabel = epic ? `${epicKey(epic.number)} ${epic.title}` : String(created.epicId);
        const sprintLabel = sprintNumber != null ? `Sprint ${sprintNumber}` : "unassigned";
        console.log(`Issue created: ${key} — ${created.title}`);
        console.log(`  Epic: ${epicLabel} | Sprint: ${sprintLabel} | Type: ${created.type} | Priority: ${created.priority}${created.storyPoints ? ` | Points: ${created.storyPoints}` : ""}`);
        if (created.description) console.log(`  Description: ${created.description}`);
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });

  issue
    .command("list")
    .description("List all project issues grouped by epic. Use --sprint <N> for sprint-scoped view.")
    .option("--sprint <n>", "List issues from a specific sprint only")
    .option("--unassigned", "Show only issues not assigned to any sprint")
    .option("--full", "Include acceptance criteria and description for each issue")
    .option("-V, --verbose", "Include description beneath each issue (alias for --full)")
    .option("--json", "Output as JSON (structured, machine-readable)")
    .action((opts: { sprint?: string; unassigned?: boolean; full?: boolean; verbose?: boolean; json?: boolean }) => {
      try {
        const pid = requireProjectId();

        // --sprint: sprint-scoped view (original behavior)
        if (opts.sprint !== undefined) {
          const n = parseInt(opts.sprint, 10);
          if (Number.isNaN(n)) throw new Error(`Invalid sprint number: "${opts.sprint}"`);
          const sprint = getSprintByNumber(pid, n);
          const issues = listIssues(sprint.id);
          if (opts.json) {
            const details: IssueDetail[] = issues.map((i) => getIssueDetail(i.id));
            console.log(JSON.stringify({ sprint, issues: details }, null, 2));
            return;
          }
          if (issues.length === 0) { console.log(`No issues in Sprint ${sprint.number}`); return; }
          const epicsMap = new Map(listEpics(pid).map((e) => [e.id, e]));
          const sprintLabel = sprint.title ? `Sprint ${sprint.number} — ${sprint.title}` : `Sprint ${sprint.number}`;
          console.log(`${sprintLabel} — ${issues.length} issue(s):\n`);
          for (const i of issues) {
            const epic = epicsMap.get(i.epicId);
            const key = epic ? issueKey(epic.number, i.number) : `#${i.id}`;
            const status = i.status.padEnd(11);
            const priority = i.priority.padEnd(7);
            const pts = i.storyPoints ? ` [${i.storyPoints}pt]` : "";
            console.log(`  ${key.padEnd(8)} [${status}] [${priority}]${pts} ${i.title}`);
            if (opts.full || opts.verbose) {
              if (i.description) console.log(`           ${i.description}`);
              const detail = getIssueDetail(i.id);
              for (const ac of detail.acs) {
                console.log(`           ${ac.completed ? "[x]" : "[ ]"} ${ac.text}`);
              }
            }
          }
          return;
        }

        // Default: project-wide view, grouped by epic
        const allIssues = getIssuesByProject(pid);
        const epicsMap = new Map(listEpics(pid).map((e) => [e.id, e]));
        const sprintMap = new Map(listSprints(pid).map((s) => [s.id, s]));

        const filtered = opts.unassigned
          ? allIssues.filter((i) => i.sprintId == null)
          : allIssues;

        if (opts.json) {
          const details = filtered.map((i) => getIssueDetail(i.id));
          console.log(JSON.stringify({ issues: details }, null, 2));
          return;
        }

        if (filtered.length === 0) {
          console.log(opts.unassigned ? "No unassigned issues." : "No issues found.");
          return;
        }

        // Group by epic (order preserved from getIssuesByProject)
        const groups = new Map<number, Issue[]>();
        for (const issue of filtered) {
          const arr = groups.get(issue.epicId) ?? [];
          arr.push(issue);
          groups.set(issue.epicId, arr);
        }

        console.log(`${filtered.length} issue(s) across ${groups.size} epic(s):\n`);
        for (const [epicId, epicIssues] of groups) {
          const epic = epicsMap.get(epicId);
          const header = epic ? `${epicKey(epic.number)} — ${epic.title}` : `Epic #${epicId}`;
          console.log(`  ${header}`);
          for (const i of epicIssues) {
            const key = epic ? issueKey(epic.number, i.number) : `#${i.id}`;
            const sprint = i.sprintId != null ? sprintMap.get(i.sprintId) : undefined;
            const sprintCtx = sprint ? `Sprint ${sprint.number}` : "unassigned";
            const statusCtx = `${i.status} — ${sprintCtx}`.padEnd(25);
            const priority = i.priority.padEnd(7);
            const pts = i.storyPoints ? ` [${i.storyPoints}pt]` : "";
            console.log(`    ${key.padEnd(8)} [${statusCtx}] [${priority}]${pts} ${i.title}`);
            if (opts.full || opts.verbose) {
              if (i.description) console.log(`             ${i.description}`);
              const detail = getIssueDetail(i.id);
              for (const ac of detail.acs) {
                console.log(`             ${ac.completed ? "[x]" : "[ ]"} ${ac.text}`);
              }
            }
          }
          console.log();
        }
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });

  issue
    .command("status <issue-id> <status>")
    .description(`Update issue status (${ISSUE_STATUSES.join("|")})`)
    .option("-r, --reason <text>", "Blocker reason (required when status=blocked)")
    .action((issueId: string, status: string, opts: { reason?: string }) => {
      try {
        if (!ISSUE_STATUSES.includes(status as IssueStatus)) {
          console.error(`Invalid status: ${status}. Must be one of: ${ISSUE_STATUSES.join(", ")}`);
          process.exit(1);
        }
        let blockerReason: string | undefined;
        if (status === "blocked") {
          if (opts.reason) {
            blockerReason = opts.reason;
          } else {
            // Interactive prompt — synchronous stdin read
            process.stdout.write("Reason for block: ");
            const buf = Buffer.alloc(1024);
            const n = readSync(0, buf, 0, buf.length, null);
            blockerReason = buf.slice(0, n).toString().trim();
            if (!blockerReason) {
              console.error("Error: blocker reason cannot be empty");
              process.exit(1);
            }
          }
        }
        const updated = updateIssueStatus(parseInt(issueId, 10), status as IssueStatus, blockerReason);
        console.log(`Issue ${updated.id} status → ${updated.status}`);
        if (updated.blockerReason) console.log(`  Blocked: ${updated.blockerReason}`);
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });

  issue
    .command("show <issue-id>")
    .description("Show full issue detail including ACs and session history")
    .action((issueId: string) => {
      try {
        const pid = requireProjectId();
        const detail = getIssueDetail(parseInt(issueId, 10));
        const epicsMap = new Map(listEpics(pid).map((e) => [e.id, e]));
        const epic = epicsMap.get(detail.epicId);
        const key = epic ? issueKey(epic.number, detail.number) : `#${detail.id}`;
        console.log(`\n${key}: ${detail.title}`);
        console.log(`  Status: ${detail.status} | Type: ${detail.type} | Priority: ${detail.priority}`);
        if (detail.status === "blocked" && detail.blockerReason) console.log(`  Blocked: ${detail.blockerReason}`);
        if (detail.assignedTo) console.log(`  Assigned: ${detail.assignedTo}`);
        if (detail.claimedBy) {
          const atPart = detail.claimedAt ? ` (at ${detail.claimedAt})` : "";
          console.log(`  Claimed by: ${detail.claimedBy}${atPart}`);
        }
        console.log(`  Tokens used: ${detail.tokensUsed}`);

        if (detail.acs.length > 0) {
          console.log(`\nAcceptance Criteria:`);
          for (const ac of detail.acs) {
            const mark = ac.completed ? "[x]" : "[ ]";
            console.log(`  ${mark} ${ac.text}`);
          }
        }

        if (detail.sessions.length > 0) {
          console.log(`\nSession History:`);
          for (const s of detail.sessions) {
            const verdict = s.auditor ? ` [${s.auditor.toUpperCase()}]` : "";
            console.log(`  ${s.date}${verdict}: ${s.summary}`);
            if (s.tokensUsed > 0) console.log(`    tokens: ${s.tokensUsed}`);
          }
        }
        console.log();
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });

  issue
    .command("ac <issue-id> <text>")
    .description("Add an acceptance criterion to an issue")
    .action((issueId: string, text: string) => {
      try {
        const ac = addAc(parseInt(issueId, 10), text);
        console.log(`AC #${ac.id} added to issue #${ac.issueId}`);
        console.log(`  [ ] ${ac.text}`);
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });

  issue
    .command("edit <issue-id>")
    .description("Edit an issue field after creation")
    .option("--title <text>", "New title")
    .option("-d, --description <text>", "New requirements body")
    .option("-p, --priority <priority>", `New priority (${PRIORITIES.join("|")})`)
    .option("-t, --type <type>", `New type (${ISSUE_TYPES.join("|")})`)
    .option("--points <n>", "New story point estimate")
    .action((issueId: string, opts: { title?: string; description?: string; priority?: string; type?: string; points?: string }) => {
      try {
        const patch: Parameters<typeof updateIssue>[1] = {};
        if (opts.title !== undefined) patch.title = opts.title;
        if (opts.description !== undefined) patch.description = opts.description;
        if (opts.priority !== undefined) {
          if (!PRIORITIES.includes(opts.priority as Priority)) {
            console.error(`Invalid priority: ${opts.priority}. Must be one of: ${PRIORITIES.join(", ")}`);
            process.exit(1);
          }
          patch.priority = opts.priority as Priority;
        }
        if (opts.type !== undefined) {
          if (!ISSUE_TYPES.includes(opts.type as IssueType)) {
            console.error(`Invalid type: ${opts.type}. Must be one of: ${ISSUE_TYPES.join(", ")}`);
            process.exit(1);
          }
          patch.type = opts.type as IssueType;
        }
        if (opts.points !== undefined) {
          const pts = parseInt(opts.points, 10);
          if (Number.isNaN(pts) || pts < 1 || pts > 13) {
            console.error("Error: --points must be a Fibonacci number between 1 and 13 (1,2,3,5,8,13)");
            process.exit(1);
          }
          patch.storyPoints = pts;
        }
        if (Object.keys(patch).length === 0) {
          console.error("Error: specify at least one field to update (--title, --description, --priority, --type, --points)");
          process.exit(1);
        }
        const updated = updateIssue(parseInt(issueId, 10), patch);
        console.log(`Issue ${updated.id} updated: ${updated.title}`);
        console.log(`  Status: ${updated.status} | Type: ${updated.type} | Priority: ${updated.priority}${updated.storyPoints ? ` | Points: ${updated.storyPoints}` : ""}`);
        if (updated.description) console.log(`  Description: ${updated.description}`);
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });
}
