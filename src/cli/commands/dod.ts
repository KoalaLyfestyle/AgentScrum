import type { Command } from "commander";
import { addDodItem, listDod, removeDodItem } from "../../services/scrum.js";
import { requireProjectId } from "../projectContext.js";

export function registerDod(program: Command): void {
  const dod = program.command("dod").description("Manage project Definition of Done");

  dod
    .command("list")
    .description("Show active DoD items for the current project")
    .action(() => {
      try {
        const items = listDod(requireProjectId());
        if (items.length === 0) {
          console.log("No DoD items set. Use 'dod add <text>' to add one.");
          return;
        }
        console.log(`\nDefinition of Done (${items.length} item${items.length === 1 ? "" : "s"}):\n`);
        for (const item of items) {
          console.log(`  [${item.id}] ${item.text}`);
        }
        console.log();
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });

  dod
    .command("add <text>")
    .description("Append a DoD item to the current project")
    .action((text: string) => {
      try {
        const item = addDodItem(requireProjectId(), text);
        console.log(`DoD item added [${item.id}]: ${item.text}`);
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });

  dod
    .command("remove <id>")
    .description("Remove a DoD item by ID")
    .action((id: string) => {
      try {
        removeDodItem(parseInt(id, 10));
        console.log(`DoD item ${id} removed.`);
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });
}
