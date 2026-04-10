import type { Command } from "commander";
import { initProject } from "../../services/scrum.js";

export function registerInit(program: Command): void {
  program
    .command("init <project-name>")
    .description("Initialize a new AgentScrum project with Sprint 1")
    .action((projectName: string) => {
      try {
        const { project, sprint } = initProject(projectName);
        console.log(`Project created: ${project.name} (id: ${project.id})`);
        console.log(`Sprint 1 created (id: ${sprint.id}, status: ${sprint.status})`);
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });
}
