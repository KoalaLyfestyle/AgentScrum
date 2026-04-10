import type { Command } from "commander";
import { createEpic, updateEpicStatus } from "../../services/scrum.js";
import type { EpicStatus } from "../../schema/types.js";

const EPIC_STATUSES: EpicStatus[] = ["active", "complete", "paused"];

export function registerEpic(program: Command): void {
  const epic = program.command("epic").description("Manage epics");

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
