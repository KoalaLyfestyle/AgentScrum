// CLI commands for the workflow steps that used to be MCP only (#27): the work
// package, session registration, decisions, and lessons. Each one calls the
// same service function as its MCP tool, and --json prints the same object.
import type { Command } from "commander";
import { getWorkPackage, logDecision, logLesson, issueKey, listEpics } from "../../services/scrum.js";
import { discoverSessionId } from "../../mcp/session.js";
import { requireProjectId } from "../projectContext.js";

function fail(err: unknown): never {
  console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}

/** Parse a whole number option, or exit with a message naming the option. */
export function parseCount(value: string, name: string, min = 0): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min) fail(`${name} must be a whole number of at least ${min}, got "${value}"`);
  return n;
}

export function registerWork(program: Command): void {
  program
    .command("work")
    .description("Get a work package: sprint goal, DoD, and issues up to a capacity (scrum_get_work_package)")
    .requiredOption("-c, --capacity <points>", "Story points available this session")
    .option("--agent <id>", "Your agent ID: include issues you claimed, skip ones other agents claimed")
    .option("--json", "Output the work package as JSON")
    .action((opts: { capacity: string; agent?: string; json?: boolean }) => {
      try {
        const pid = requireProjectId();
        const pkg = getWorkPackage(pid, parseCount(opts.capacity, "--capacity", 1), opts.agent);
        if (opts.json) {
          console.log(JSON.stringify(pkg, null, 2));
          return;
        }
        const s = pkg.sprint;
        console.log(`\nSprint ${s.number}${s.title ? ` — ${s.title}` : ""}  [${s.status.toUpperCase()}]`);
        if (s.goal) console.log(`Goal: ${s.goal}`);
        console.log(`Capacity: ${pkg.capacityUsed} of ${pkg.capacityRequested} points`);
        const epics = new Map(listEpics(pid).map((e) => [e.id, e]));
        console.log(`\nIssues (${pkg.issues.length}):`);
        for (const i of pkg.issues) {
          const epic = epics.get(i.epicId);
          const key = epic ? issueKey(epic.number, i.number) : `#${i.id}`;
          const pts = i.storyPoints ? ` [${i.storyPoints}pt]` : "";
          console.log(`  ${key} (id ${i.id})${pts} ${i.title}`);
          for (const ac of i.acs) console.log(`    ${ac.completed ? "[x]" : "[ ]"} (ac ${ac.id}) ${ac.text}`);
        }
        if (pkg.dod.length > 0) {
          console.log(`\nDefinition of Done:`);
          for (const d of pkg.dod) console.log(`  ${d.completed ? "[x]" : "[ ]"} (item ${d.id}) ${d.text}`);
        }
        if (pkg.decisions.length + pkg.lessons.length > 0) {
          console.log(`\n${pkg.decisions.length} decision(s) and ${pkg.lessons.length} lesson(s): read them with --json.`);
        }
        console.log();
      } catch (err) {
        fail(err);
      }
    });
}

export function registerSession(program: Command): void {
  const session = program.command("session").description("Claude Code session IDs for cost attribution");

  session
    .command("register")
    .description(
      "Find (or check) this folder's Claude Code session ID (scrum_register_session). The CLI keeps no state " +
        "between runs, so pass the ID to 'issue claim --session <id>'."
    )
    .option("--id <session-id>", "Session ID to use instead of discovering it")
    .option("--json", "Output as JSON")
    .action((opts: { id?: string; json?: boolean }) => {
      try {
        const dir = process.cwd();
        const sessionId = opts.id ?? discoverSessionId(dir);
        if (!sessionId) throw new Error("No session ID provided and none discoverable from transcript directory");
        const result = { registered: true, cwd: dir, session_id: sessionId };
        if (opts.json) {
          console.log(JSON.stringify(result, null, 2));
          return;
        }
        console.log(`Session ${sessionId} for ${dir}`);
        console.log(`Pass it when you claim: scrum <project> issue claim <id> --by <agent> --session ${sessionId}`);
      } catch (err) {
        fail(err);
      }
    });
}

export function registerDecision(program: Command): void {
  const decision = program.command("decision").description("Record decisions (ADR-lite)");

  decision
    .command("add <title>")
    .description("Record a decision so later agents do not relitigate it (scrum_log_decision)")
    .requiredOption("--context <text>", "Why the decision was needed")
    .requiredOption("--decision <text>", "What was decided")
    .option("--rejected <text>", "Alternatives considered and rejected, and why")
    .option("--consequences <text>", "Known trade-offs or follow-on work")
    .option("--json", "Output the decision as JSON")
    .action(
      (title: string, opts: { context: string; decision: string; rejected?: string; consequences?: string; json?: boolean }) => {
        try {
          const record = logDecision({
            projectId: requireProjectId(),
            title,
            context: opts.context,
            decision: opts.decision,
            rejectedAlternatives: opts.rejected,
            consequences: opts.consequences,
          });
          if (opts.json) {
            console.log(JSON.stringify(record, null, 2));
            return;
          }
          console.log(`Decision ${record.id} recorded: ${record.title}`);
        } catch (err) {
          fail(err);
        }
      }
    );
}

export function registerLesson(program: Command): void {
  const lesson = program.command("lesson").description("Record lessons from failures");

  lesson
    .command("add <title>")
    .description("Record a lesson future agents read before similar work (scrum_log_lesson)")
    .requiredOption("--what-failed <text>", "What went wrong and how it showed")
    .requiredOption("--dont-repeat <text>", "What not to do next time")
    .option("--tags <list>", "Comma-separated tags, e.g. 'drizzle,migration'")
    .option("--global", "Record it for all projects instead of the current one")
    .option("--json", "Output the lesson as JSON")
    .action(
      (title: string, opts: { whatFailed: string; dontRepeat: string; tags?: string; global?: boolean; json?: boolean }) => {
        try {
          const record = logLesson({
            projectId: opts.global ? undefined : requireProjectId(),
            title,
            whatFailed: opts.whatFailed,
            dontRepeat: opts.dontRepeat,
            tags: opts.tags,
          });
          if (opts.json) {
            console.log(JSON.stringify(record, null, 2));
            return;
          }
          console.log(`Lesson ${record.id} recorded: ${record.title}`);
        } catch (err) {
          fail(err);
        }
      }
    );
}
