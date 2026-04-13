import type { Command } from "commander";
import { createEpic, listEpics, updateEpic, getIssuesByEpic, listSprints, epicKey, issueKey } from "../../services/scrum.js";
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

  epic
    .command("show <epic-id>")
    .description("Show an epic and all its issues across all sprints")
    .option("--json", "Output issues as JSON")
    .action((epicId: string, opts: { json?: boolean }) => {
      try {
        const pid = requireProjectId();
        const epics = listEpics(pid);
        const epic = epics.find((e) => e.id === parseInt(epicId, 10));
        if (!epic) throw new Error(`Epic ${epicId} not found`);

        const issues = getIssuesByEpic(epic.id);

        if (opts.json) {
          console.log(JSON.stringify({ epic, issues }, null, 2));
          return;
        }

        console.log(`\n${epicKey(epic.number)} — ${epic.title}`);
        if (issues.length === 0) {
          console.log("  No issues in this epic yet.");
          console.log();
          return;
        }

        const sprintMap = new Map(listSprints(pid).map((s) => [s.id, s]));
        console.log();
        for (const i of issues) {
          const key = issueKey(epic.number, i.number);
          const sprint = (i.sprintId as number | null) != null ? sprintMap.get(i.sprintId!) : undefined;
          const sprintCtx = sprint ? `Sprint ${sprint.number}` : "unassigned";
          const statusCtx = `${i.status} — ${sprintCtx}`.padEnd(25);
          const priority = i.priority.padEnd(7);
          const pts = i.storyPoints ? ` [${i.storyPoints}pt]` : "";
          console.log(`  ${key.padEnd(8)} [${statusCtx}] [${priority}]${pts} ${i.title}`);
        }
        console.log();
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });
}
