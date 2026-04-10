#!/usr/bin/env node
import { Command } from "commander";
import { registerInit } from "./commands/init.js";
import { registerEpic } from "./commands/epic.js";
import { registerIssue } from "./commands/issue.js";
import { registerStatus } from "./commands/status.js";
import { registerLog } from "./commands/log.js";
import { registerDod } from "./commands/dod.js";

const program = new Command();

program
  .name("scrum")
  .description(
    [
      "AgentScrum — Scrum management for agent swarms",
      "",
      "Examples:",
      "  scrum init myproject              # create project + Sprint 1 (interactive DoD prompt)",
      "  scrum status                      # show sprint summary",
      "  scrum status --json               # machine-readable output",
      "  scrum issue list --full           # issues with ACs inline",
      "  scrum issue list --json           # full JSON for agent consumption",
      "  scrum issue add 1 'Auth route' --description 'Add JWT middleware' --points 3",
      "  scrum dod list                    # show Definition of Done checklist",
      "",
      "Environment variables:",
      "  SCRUM_DB_PATH      SQLite file path (default: ./agentscrum.db)",
      "  SCRUM_PROJECT_ID   Active project ID (required for most commands)",
    ].join("\n")
  )
  .version("0.1.0")
  .addHelpCommand("help [command]", "Display help for a command");

registerInit(program);
registerEpic(program);
registerIssue(program);
registerStatus(program);
registerLog(program);
registerDod(program);

// Show help when called with no arguments
if (process.argv.length === 2) {
  program.help();
}

program.parse(process.argv);
