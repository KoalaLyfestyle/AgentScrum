#!/usr/bin/env node
import { Command } from "commander";
import { registerInit } from "./commands/init.js";
import { registerProject } from "./commands/project.js";
import { registerEpic } from "./commands/epic.js";
import { registerSprint } from "./commands/sprint.js";
import { registerIssue } from "./commands/issue.js";
import { registerStatus } from "./commands/status.js";
import { registerLog } from "./commands/log.js";
import { registerDod } from "./commands/dod.js";
import { registerBacklog } from "./commands/backlog.js";
import { registerRetro } from "./commands/retro.js";
import { registerCost } from "./commands/cost.js";
import { registerWork, registerSession, registerDecision, registerLesson } from "./commands/workflow.js";
import { findProject } from "../services/scrum.js";
import { setCreateOnOpen } from "../db/index.js";
import { warnIfUnsupportedNode } from "../db/open.js";
import { isReservedWord } from "./reserved.js";

// ---------------------------------------------------------------------------
// Project resolution
// Supports: scrum <project-name-or-id> <command> [args]
// If argv[2] is not a reserved command or flag (./reserved.ts), treat it as a
// project identifier.
// Splices it out so Commander sees the subcommand directly, then resolves it to
// a project ID and injects SCRUM_PROJECT_ID before the command's action runs.
//
// Nothing here opens the database for help or version output. Working-directory
// detection happens lazily in requireProjectId(), only for commands that need a
// project.
// ---------------------------------------------------------------------------

// The explicit project, if one was named. It is looked up in a preAction hook
// (below), so help and version output, which exit before any action runs,
// never open the database.
let explicitProject: string | undefined;

const firstArg = process.argv[2];

// Only `scrum init` may create a database (#30). Every other command fails on a
// missing file instead of creating an empty one (see setCreateOnOpen).
if (firstArg !== "init") setCreateOnOpen(false);
if (firstArg && !isReservedWord(firstArg) && !firstArg.startsWith("-")) {
  process.argv.splice(2, 1); // remove so Commander sees the subcommand
  if (process.argv.length === 2) {
    // `scrum <name>` alone: check it now, so a typo fails instead of printing help.
    resolveExplicitProject(firstArg);
  } else {
    explicitProject = firstArg;
  }
}

function resolveExplicitProject(nameOrId: string): void {
  try {
    const project = findProject(nameOrId);
    process.env["SCRUM_PROJECT_ID"] = String(project.id);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
const program = new Command();

program
  .name("scrum")
  .description(
    [
      "AgentScrum — Scrum management for agent swarms",
      "",
      "Usage with project name (recommended):",
      "  scrum <project> <command>",
      "",
      "Examples:",
      "  scrum init myproject              # create project + Sprint 1",
      "  scrum myproject status            # sprint summary",
      "  scrum myproject status --json     # machine-readable output",
      "  scrum myproject issue list --full   # issues with ACs inline",
      "  scrum myproject issue list --json   # full JSON for agent use",
      "  scrum myproject issue edit 5 --priority high --points 3",
      "  scrum myproject sprint list         # all sprints with titles + status",
      "  scrum myproject sprint update 4 --title 'Cleanup' --pr-title 'Sprint 4: Polish'",
      "  scrum myproject sprint velocity     # story points completed per sprint",
      "  scrum myproject backlog             # issues in planning sprints",
      "  scrum project list                  # all projects",
      "  scrum myproject dod list            # show Definition of Done",
      "  scrum myproject work -c 20 --agent me   # work package, as scrum_get_work_package",
      "  scrum myproject issue claim 5 --by me   # claim, as scrum_assign_issue",
      "",
      "Environment variables (set in .env or shell):",
      "  SCRUM_DB_PATH      SQLite file; relative paths resolve from the AgentScrum checkout",
      "                     (default: <checkout>/agentscrum.db; AGENTSCRUM_DB_PATH is an alias)",
      "  SCRUM_PROJECT_ID   fallback project ID if no project name is passed",
    ].join("\n")
  )
  .version("0.2.0")
  .addHelpCommand("help [command]", "Display help for a command")
  .hook("preAction", () => {
    if (explicitProject !== undefined) resolveExplicitProject(explicitProject);
  });

registerInit(program);
registerProject(program);
registerEpic(program);
registerSprint(program);
registerIssue(program);
registerStatus(program);
registerLog(program);
registerDod(program);
registerBacklog(program);
registerRetro(program);
registerCost(program);
registerWork(program);
registerSession(program);
registerDecision(program);
registerLesson(program);

// Show help when called with no arguments
if (process.argv.length === 2) {
  program.help();
}

warnIfUnsupportedNode();
program.parse(process.argv);
