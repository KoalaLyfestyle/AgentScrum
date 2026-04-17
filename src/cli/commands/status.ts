import type { Command } from "commander";
import { getActiveSprint, getSprintSummary, getSprintDodStatus, listEpics, issueKey } from "../../services/scrum.js";
import { requireProjectId } from "../projectContext.js";

export function registerStatus(program: Command): void {
  program
    .command("status")
    .description("Print current sprint summary")
    .option("--json", "Output as JSON (structured, machine-readable)")
    .action((opts: { json?: boolean }) => {
      try {
        const pid = requireProjectId();
        const sprint = getActiveSprint(pid);
        const summary = getSprintSummary(sprint.id);
        const dod = getSprintDodStatus(pid, sprint.id);

        if (opts.json) {
          console.log(JSON.stringify({ ...summary, dod }, null, 2));
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
          const epicsMap = new Map(listEpics(pid).map((e) => [e.id, e]));
          const epic = epicsMap.get(summary.activeIssue.epicId);
          const key = epic ? issueKey(epic.number, summary.activeIssue.number) : `#${summary.activeIssue.id}`;
          console.log(`\nActive: ${key} — ${summary.activeIssue.title}`);
        }

        if (dod.length > 0) {
          const done = dod.filter((d) => d.completed).length;
          console.log(`\nDoD (${done}/${dod.length} complete):`);
          for (const d of dod) console.log(`  ${d.completed ? "[x]" : "[ ]"} ${d.text}`);
        }
        console.log();
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });
}
