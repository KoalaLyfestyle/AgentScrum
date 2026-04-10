#!/usr/bin/env node
import { Command } from "commander";
import { registerInit } from "./commands/init.js";
import { registerEpic } from "./commands/epic.js";
import { registerIssue } from "./commands/issue.js";
import { registerStatus } from "./commands/status.js";
import { registerLog } from "./commands/log.js";
import { registerDod } from "./commands/dod.js";
import { findProject } from "../services/scrum.js";

// ---------------------------------------------------------------------------
// Project resolution
// Supports: scrum <project-name-or-id> <command> [args]
// If argv[2] is not a reserved command or flag, treat it as a project identifier.
// Resolves it to a project ID and injects SCRUM_PROJECT_ID, then splices it out
// so Commander sees the subcommand directly.
// ---------------------------------------------------------------------------
const RESERVED = new Set([
  "init", "epic", "issue", "status", "log", "dod", "help",
  "--help", "-h", "--version", "-V",
]);

const firstArg = process.argv[2];
if (firstArg && !RESERVED.has(firstArg) && !firstArg.startsWith("-")) {
  try {
    const project = findProject(firstArg);
    process.env["SCRUM_PROJECT_ID"] = String(project.id);
    process.argv.splice(2, 1); // remove so Commander sees the subcommand
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
      "  scrum myproject issue list --full # issues with ACs inline",
      "  scrum myproject issue list --json # full JSON for agent use",
      "  scrum myproject issue add 1 'Auth route' --description 'Add JWT middleware' --points 3",
      "  scrum myproject dod list          # show Definition of Done",
      "",
      "Environment variables (set in .env or shell):",
      "  SCRUM_DB_PATH      absolute path to SQLite file (default: ./agentscrum.db)",
      "  SCRUM_PROJECT_ID   fallback project ID if no project name is passed",
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
