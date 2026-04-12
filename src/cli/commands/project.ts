import type { Command } from "commander";
import { listProjects } from "../../services/scrum.js";

export function registerProject(program: Command): void {
  const project = program.command("project").description("Manage projects");

  project
    .command("list")
    .description("List all projects in the database")
    .option("--json", "Output as JSON")
    .action((opts: { json?: boolean }) => {
      try {
        const projects = listProjects();
        if (opts.json) {
          console.log(JSON.stringify(projects, null, 2));
          return;
        }
        if (projects.length === 0) {
          console.log("No projects found. Run 'scrum init <name>' to create one.");
          return;
        }
        console.log(`Projects (${projects.length}):\n`);
        for (const p of projects) {
          const date = p.createdAt.slice(0, 10);
          console.log(`  #${p.id}  ${p.name}  (created ${date})`);
        }
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });
}
