import type { Command } from "commander";
import { createEpic, listEpics, updateEpic, updateEpicStatus, epicKey } from "../../services/scrum.js";
import type { EpicStatus } from "../../schema/types.js";
import { requireProjectId } from "../projectContext.js";

const EPIC_STATUSES: EpicStatus[] = ["active", "complete", "paused"];

export function registerEpic(program: Command): void {
  const epic = program.command("epic").description("Manage epics");

  epic
    .command("list")
    .description("List all epics for the current project")
    .option("-V, --verbose", "Include epic status detail")
    .option("--json", "Output as JSON")
    .action((opts: { verbose?: boolean; json?: boolean }) => {
      try {
        const epics = listEpics(requireProjectId());
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
          console.log(`  ${epicKey(e.number)}  [${status}]  ${e.title}`);
        }
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });

  epic
    .command("edit <epic-id>")
    .description("Edit an epic's title or status")
    .option("--title <text>", "New title")
    .option("--status <status>", `New status (${EPIC_STATUSES.join("|")})`)
    .action((epicId: string, opts: { title?: string; status?: string }) => {
      try {
        const patch: { title?: string; status?: EpicStatus } = {};
        if (opts.title !== undefined) patch.title = opts.title;
        if (opts.status !== undefined) {
          if (!EPIC_STATUSES.includes(opts.status as EpicStatus)) {
            console.error(`Invalid status: ${opts.status}. Must be one of: ${EPIC_STATUSES.join(", ")}`);
            process.exit(1);
          }
          patch.status = opts.status as EpicStatus;
        }
        if (Object.keys(patch).length === 0) {
          console.error("Error: specify at least one field (--title, --status)");
          process.exit(1);
        }
        const updated = updateEpic(parseInt(epicId, 10), patch);
        console.log(`${epicKey(updated.number)} updated: ${updated.title}  [${updated.status}]`);
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });

  epic
    .command("add <title>")
    .description("Create a new epic in the current project")
    .action((title: string) => {
      try {
        const created = createEpic(requireProjectId(), title);
        console.log(`Epic created: ${epicKey(created.number)} — ${created.title}`);
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
        console.log(`${epicKey(updated.number)} status → ${updated.status}`);
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });
}
