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
import { findProject, findProjectByDirectory } from "../services/scrum.js";

// ---------------------------------------------------------------------------
// Project resolution
// Supports: scrum <project-name-or-id> <command> [args]
// If argv[2] is not a reserved command or flag, treat it as a project identifier.
// Resolves it to a project ID and injects SCRUM_PROJECT_ID, then splices it out
// so Commander sees the subcommand directly.
// ---------------------------------------------------------------------------
const RESERVED = new Set([
  "init", "project", "epic", "sprint", "issue", "status", "log", "dod", "backlog", "help",
  "--help", "-h", "--version", "-V",
]);

const firstArg = process.argv[2];
if (firstArg && !RESERVED.has(firstArg) && !firstArg.startsWith("-")) {
  // Explicit project name/id passed — resolve it
  try {
    const project = findProject(firstArg);
    process.env["SCRUM_PROJECT_ID"] = String(project.id);
    process.argv.splice(2, 1); // remove so Commander sees the subcommand
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
} else if (!process.env["SCRUM_PROJECT_ID"]) {
  // No explicit project and no env var — try CWD detection
  try {
    const detected = findProjectByDirectory(process.cwd());
    if (detected) {
      process.env["SCRUM_PROJECT_ID"] = String(detected.id);
    }
    // If not detected, commands that need a project will show a helpful error at runtime
  } catch {
    // DB not set up yet — commands that need a project will handle this
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
      "",
      "Environment variables (set in .env or shell):",
      "  SCRUM_DB_PATH      absolute path to SQLite file (default: ./agentscrum.db)",
      "  SCRUM_PROJECT_ID   fallback project ID if no project name is passed",
    ].join("\n")
  )
  .version("0.1.0")
  .addHelpCommand("help [command]", "Display help for a command");

registerInit(program);
registerProject(program);
registerEpic(program);
registerSprint(program);
registerIssue(program);
registerStatus(program);
registerLog(program);
registerDod(program);
registerBacklog(program);

// Show help when called with no arguments
if (process.argv.length === 2) {
  program.help();
}

program.parse(process.argv);
