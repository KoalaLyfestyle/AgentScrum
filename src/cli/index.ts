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
  .description("AgentScrum — Scrum management for agent swarms")
  .version("0.1.0");

registerInit(program);
registerEpic(program);
registerIssue(program);
registerStatus(program);
registerLog(program);
registerDod(program);

program.parse(process.argv);
