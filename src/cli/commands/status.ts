import type { Command } from "commander";
import { getActiveSprint, getSprintSummary, listDod } from "../../services/scrum.js";

function projectId(): number {
  const raw = process.env["SCRUM_PROJECT_ID"];
  if (!raw) {
    console.error("Error: SCRUM_PROJECT_ID env var is required");
    process.exit(1);
  }
  return parseInt(raw, 10);
}

export function registerStatus(program: Command): void {
  program
    .command("status")
    .description("Print current sprint summary")
    .option("--json", "Output as JSON (structured, machine-readable)")
    .action((opts: { json?: boolean }) => {
      try {
        const pid = projectId();
        const sprint = getActiveSprint(pid);
        const summary = getSprintSummary(sprint.id);
        const dod = listDod(pid);

        if (opts.json) {
          console.log(JSON.stringify({ ...summary, dod: dod.map((d) => d.text) }, null, 2));
          return;
        }

        console.log(`\nSprint ${summary.sprint.number} — ${summary.sprint.status.toUpperCase()}`);
        if (summary.sprint.goal) console.log(`Goal: ${summary.sprint.goal}`);
        console.log(`\nIssues: ${summary.total} total`);

        const order = ["in_progress", "todo", "review", "blocked", "done"] as const;
        for (const s of order) {
          const count = summary.byStatus[s];
          if (count > 0) {
            console.log(`  ${s.padEnd(12)}: ${count}`);
          }
        }

        if (summary.activeIssue) {
          console.log(`\nActive: #${summary.activeIssue.id} — ${summary.activeIssue.title}`);
        }

        if (dod.length > 0) {
          console.log(`\nDoD (${dod.length} items):`);
          for (const d of dod) console.log(`  [ ] ${d.text}`);
        }
        console.log();
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });
}
