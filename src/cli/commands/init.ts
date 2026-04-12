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
        const { project, sprint } = initProject(projectName, process.cwd());
        console.log(`Project created: ${project.name} (id: ${project.id})`);
        console.log(`Sprint 1 created (id: ${sprint.id}, status: ${sprint.status})`);

        if (!process.env["SCRUM_DB_PATH"]) {
          const absPath = `${process.cwd()}/agentscrum.db`;
          console.warn(`\nWarning: SCRUM_DB_PATH is not set — using relative path './agentscrum.db'.`);
          console.warn(`CLI commands run from other directories will not find this database.`);
          console.warn(`Set it once in your shell profile:`);
          console.warn(`  export SCRUM_DB_PATH=${absPath}\n`);
        }

        console.log(`\nDefinition of Done — enter items one at a time, blank line to finish:`);
        const dodItems = await promptDod();
        if (dodItems.length > 0) {
          setDod(project.id, dodItems);
          console.log(`DoD saved (${dodItems.length} item${dodItems.length === 1 ? "" : "s"}).`);
        } else {
          console.log(`No DoD items added. Use 'scrum ${project.name} dod add <text>' to add later.`);
        }

        console.log(`
────────────────────────────────────────────────────────
Add this to your project's CLAUDE.md to wire up AgentScrum:

# ${project.name}

## AgentScrum
At the start of every session, call:
  scrum_get_work_package { project_id: ${project.id}, capacity: <story_points> }

This returns your sprint goal, Definition of Done, and fully-briefed
issues (with ACs) in one call — no follow-up reads needed.

After completing each issue:
1. Mark it done: scrum_update_issue_status { issue_id: <id>, status: "done" }
2. Log the session: scrum_log_session { issue_id: <id>, summary: "..." }
3. Check off DoD items before moving to the next issue.
────────────────────────────────────────────────────────
`);
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });
}
