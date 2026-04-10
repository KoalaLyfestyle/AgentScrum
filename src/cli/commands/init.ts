import readline from "readline";
import type { Command } from "commander";
import { initProject, setDod } from "../../services/scrum.js";

async function promptDod(): Promise<string[]> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const items: string[] = [];
  let i = 1;
  await new Promise<void>((resolve) => {
    function ask() {
      rl.question(`DoD ${i}: `, (answer) => {
        if (!answer.trim()) {
          rl.close();
          resolve();
        } else {
          items.push(answer.trim());
          i++;
          ask();
        }
      });
    }
    ask();
  });
  return items;
}

export function registerInit(program: Command): void {
  program
    .command("init <project-name>")
    .description("Initialize a new AgentScrum project with Sprint 1")
    .action(async (projectName: string) => {
      try {
        const { project, sprint } = initProject(projectName);
        console.log(`Project created: ${project.name} (id: ${project.id})`);
        console.log(`Sprint 1 created (id: ${sprint.id}, status: ${sprint.status})`);

        console.log(`\nDefinition of Done — enter items one at a time, blank line to finish:`);
        const dodItems = await promptDod();
        if (dodItems.length > 0) {
          setDod(project.id, dodItems);
          console.log(`DoD saved (${dodItems.length} item${dodItems.length === 1 ? "" : "s"}).`);
        } else {
          console.log(`No DoD items added. Use 'npx agentscrum dod add <text>' to add later.`);
        }
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });
}
