import type { Command } from "commander";
import { addDodItem, listDod, removeDodItem, completeDodItem, getSprintByNumber, listSprints } from "../../services/scrum.js";
import { requireProjectId } from "../projectContext.js";
import { parseCount } from "./workflow.js";

export function registerDod(program: Command): void {
  const dod = program.command("dod").description("Manage project Definition of Done");

  dod
    .command("list")
    .description("Show active DoD items for the current project")
    .option("--json", "Output as JSON")
    .action((opts: { json?: boolean }) => {
      try {
        const items = listDod(requireProjectId());
        if (opts.json) {
          console.log(JSON.stringify(items, null, 2));
          return;
        }
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

  dod
    .command("done <item-id>")
    .description("Mark a DoD item done for a sprint (scrum_complete_dod_item). Safe to run twice.")
    .option("--sprint <number>", "Sprint number (default: the active sprint)")
    .option("--json", "Output the completion as JSON")
    .action((itemId: string, opts: { sprint?: string; json?: boolean }) => {
      try {
        const pid = requireProjectId();
        let sprintId: number;
        if (opts.sprint !== undefined) {
          sprintId = getSprintByNumber(pid, parseCount(opts.sprint, "--sprint", 1)).id;
        } else {
          const active = listSprints(pid).find((s) => s.status === "active");
          if (!active) throw new Error("no active sprint; pass --sprint <number>");
          sprintId = active.id;
        }
        const done = completeDodItem(sprintId, parseCount(itemId, "DoD item id", 1));
        if (opts.json) {
          console.log(JSON.stringify(done, null, 2));
          return;
        }
        console.log(`DoD item ${done.dodItemId} done for this sprint: ${done.dodText}`);
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });
}
