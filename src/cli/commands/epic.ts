import type { Command } from "commander";
import { createEpic, listEpics, updateEpic, epicKey } from "../../services/scrum.js";
import { requireProjectId } from "../projectContext.js";

export function registerEpic(program: Command): void {
  const epic = program.command("epic").description("Manage epics");

  epic
    .command("list")
    .description("List all epics for the current project")
    .option("--json", "Output as JSON")
    .action((opts: { json?: boolean }) => {
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
          console.log(`  ${epicKey(e.number)}  ${e.title}`);
        }
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });

  epic
    .command("edit <epic-id>")
    .description("Rename an epic")
    .option("--title <text>", "New title")
    .action((epicId: string, opts: { title?: string }) => {
      try {
        if (!opts.title) {
          console.error("Error: specify --title");
          process.exit(1);
        }
        const updated = updateEpic(parseInt(epicId, 10), { title: opts.title });
        console.log(`${epicKey(updated.number)} renamed: ${updated.title}`);
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
}
