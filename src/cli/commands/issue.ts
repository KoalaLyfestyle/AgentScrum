import type { Command } from "commander";
import {
  createIssue,
  listIssues,
  updateIssueStatus,
  getIssueDetail,
  getActiveSprint,
  addAc,
} from "../../services/scrum.js";
import type { IssueDetail, IssueStatus, IssueType, Priority } from "../../schema/types.js";

const ISSUE_STATUSES: IssueStatus[] = ["todo", "in_progress", "review", "done", "blocked"];
const ISSUE_TYPES: IssueType[] = ["feature", "bugfix", "refactor", "test", "docs"];
const PRIORITIES: Priority[] = ["high", "medium", "low"];

function projectId(): number {
  const raw = process.env["SCRUM_PROJECT_ID"];
  if (!raw) {
    console.error("Error: SCRUM_PROJECT_ID env var is required");
    process.exit(1);
  }
  return parseInt(raw, 10);
}

export function registerIssue(program: Command): void {
  const issue = program.command("issue").description("Manage issues");

  issue
    .command("add <epic-id> <title>")
    .description("Create a new issue in the current sprint")
    .option("-t, --type <type>", `Issue type (${ISSUE_TYPES.join("|")})`, "feature")
    .option("-p, --priority <priority>", `Priority (${PRIORITIES.join("|")})`, "medium")
    .option("-d, --description <text>", "Requirements body — what to build and why")
    .option("--points <n>", "Story point estimate (Fibonacci: 1, 2, 3, 5, 8, 13)")
    .action((epicId: string, title: string, opts: { type: string; priority: string; description?: string; points?: string }) => {
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
        const sprint = getActiveSprint(projectId());
        const created = createIssue(parseInt(epicId, 10), sprint.id, title, type, priority, opts.description, storyPoints);
        console.log(`Issue created: #${created.id} — ${created.title}`);
        console.log(`  Epic: ${created.epicId} | Sprint: ${created.sprintId} | Type: ${created.type} | Priority: ${created.priority}${created.storyPoints ? ` | Points: ${created.storyPoints}` : ""}`);
        if (created.description) console.log(`  Description: ${created.description}`);
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });

  issue
    .command("list")
    .description("List all issues in the current sprint")
    .option("--full", "Include acceptance criteria and description for each issue")
    .option("--json", "Output as JSON (structured, machine-readable)")
    .action((opts: { full?: boolean; json?: boolean }) => {
      try {
        const sprint = getActiveSprint(projectId());
        const issues = listIssues(sprint.id);

        if (opts.json) {
          const details: IssueDetail[] = issues.map((i) => getIssueDetail(i.id));
          console.log(JSON.stringify({ sprint, issues: details }, null, 2));
          return;
        }

        if (issues.length === 0) {
          console.log(`No issues in Sprint ${sprint.number}`);
          return;
        }
        console.log(`Sprint ${sprint.number} — ${issues.length} issue(s):\n`);
        const padId = String(Math.max(...issues.map((i) => i.id))).length + 1;
        for (const i of issues) {
          const status = i.status.padEnd(11);
          const priority = i.priority.padEnd(7);
          const pts = i.storyPoints ? ` [${i.storyPoints}pt]` : "";
          console.log(`  #${String(i.id).padStart(padId)} [${status}] [${priority}]${pts} ${i.title}`);
          if (opts.full) {
            if (i.description) console.log(`         ${i.description}`);
            const detail = getIssueDetail(i.id);
            for (const ac of detail.acs) {
              console.log(`         ${ac.completed ? "[x]" : "[ ]"} ${ac.text}`);
            }
          }
        }
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });

  issue
    .command("status <issue-id> <status>")
    .description(`Update issue status (${ISSUE_STATUSES.join("|")})`)
    .action((issueId: string, status: string) => {
      try {
        if (!ISSUE_STATUSES.includes(status as IssueStatus)) {
          console.error(`Invalid status: ${status}. Must be one of: ${ISSUE_STATUSES.join(", ")}`);
          process.exit(1);
        }
        const updated = updateIssueStatus(parseInt(issueId, 10), status as IssueStatus);
        console.log(`Issue #${updated.id} status → ${updated.status}`);
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
        const detail = getIssueDetail(parseInt(issueId, 10));
        console.log(`\nIssue #${detail.id}: ${detail.title}`);
        console.log(`  Status: ${detail.status} | Type: ${detail.type} | Priority: ${detail.priority}`);
        if (detail.assignedTo) console.log(`  Assigned: ${detail.assignedTo}`);
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
}
