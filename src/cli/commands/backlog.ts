import type { Command } from "commander";
import { getBacklog, getIssueDetail } from "../../services/scrum.js";

function projectId(): number {
  const raw = process.env["SCRUM_PROJECT_ID"];
  if (!raw) {
    console.error("Error: SCRUM_PROJECT_ID env var is required (use 'scrum <project> backlog')");
    process.exit(1);
  }
  return parseInt(raw, 10);
}

export function registerBacklog(program: Command): void {
  program
    .command("backlog")
    .description("List backlog issues (issues in planning sprints, not yet started)")
    .option("-V, --verbose", "Include description and acceptance criteria for each issue")
    .option("--json", "Output as JSON")
    .action((opts: { verbose?: boolean; json?: boolean }) => {
      try {
        const issues = getBacklog(projectId());
        if (opts.json) {
          const details = issues.map((i) => getIssueDetail(i.id));
          console.log(JSON.stringify(details, null, 2));
          return;
        }
        if (issues.length === 0) {
          console.log("Backlog is empty — no issues in planning sprints.");
          return;
        }
        console.log(`Backlog (${issues.length} issue${issues.length === 1 ? "" : "s"}):\n`);
        const padId = String(Math.max(...issues.map((i) => i.id))).length + 1;
        for (const i of issues) {
          const priority = i.priority.padEnd(7);
          const pts = i.storyPoints ? ` [${i.storyPoints}pt]` : "";
          console.log(`  #${String(i.id).padStart(padId)} [${priority}]${pts} ${i.title}`);
          if (opts.verbose) {
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
}
