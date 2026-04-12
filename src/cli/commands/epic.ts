import type { Command } from "commander";
import { createEpic, listEpics, updateEpicStatus } from "../../services/scrum.js";
import type { EpicStatus } from "../../schema/types.js";

const EPIC_STATUSES: EpicStatus[] = ["active", "complete", "paused"];

function projectId(): number {
  const raw = process.env["SCRUM_PROJECT_ID"];
  if (!raw) {
    console.error("Error: SCRUM_PROJECT_ID env var is required (use 'scrum <project> epic ...')");
    process.exit(1);
  }
  return parseInt(raw, 10);
}

export function registerEpic(program: Command): void {
  const epic = program.command("epic").description("Manage epics");

  epic
    .command("list")
    .description("List all epics for the current project")
    .option("-V, --verbose", "Include epic status detail")
    .option("--json", "Output as JSON")
    .action((opts: { verbose?: boolean; json?: boolean }) => {
      try {
        const epics = listEpics(projectId());
        if (opts.json) {
          console.log(JSON.stringify(epics, null, 2));
          return;
        }
        if (epics.length === 0) {
          console.log("No epics found.");
          return;
        }
        console.log(`Epics (${epics.length}):\n`);
        for (const e of epics) {
          const status = e.status.padEnd(8);
          console.log(`  #${e.id}  [${status}]  ${e.title}`);
        }
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });

  epic
    .command("add <project-id> <title>")
    .description("Create a new epic")
    .action((projectId: string, title: string) => {
      try {
        const created = createEpic(parseInt(projectId, 10), title);
        console.log(`Epic created: #${created.id} — ${created.title}`);
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });

  epic
    .command("status <epic-id> <status>")
    .description(`Update epic status (${EPIC_STATUSES.join("|")})`)
    .action((epicId: string, status: string) => {
      try {
        if (!EPIC_STATUSES.includes(status as EpicStatus)) {
          console.error(`Invalid status: ${status}. Must be one of: ${EPIC_STATUSES.join(", ")}`);
          process.exit(1);
        }
        const updated = updateEpicStatus(parseInt(epicId, 10), status as EpicStatus);
        console.log(`Epic #${updated.id} status → ${updated.status}`);
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });
}
