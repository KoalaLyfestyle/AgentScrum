import type { Command } from "commander";
import { logSession } from "../../services/scrum.js";
import type { AuditorVerdict } from "../../schema/types.js";

const VERDICTS: AuditorVerdict[] = ["pass", "fail", "skipped"];

export function registerLog(program: Command): void {
  program
    .command("log <issue-id> <summary>")
    .description("Append a session log entry to an issue")
    .option("--tokens <n>", "Tokens used in this session", "0")
    .option("--auditor <verdict>", `Auditor verdict (${VERDICTS.join("|")})`)
    .option("--model <name>", "Model used in this session (e.g. claude-sonnet-4-6)")
    .action(
      (
        issueId: string,
        summary: string,
        opts: { tokens: string; auditor?: string; model?: string }
      ) => {
        try {
          const tokens = parseInt(opts.tokens, 10);
          if (isNaN(tokens) || tokens < 0) {
            console.error("Error: --tokens must be a non-negative integer");
            process.exit(1);
          }

          let auditor: AuditorVerdict | undefined;
          if (opts.auditor) {
            if (!VERDICTS.includes(opts.auditor as AuditorVerdict)) {
              console.error(
                `Invalid auditor verdict: ${opts.auditor}. Must be one of: ${VERDICTS.join(", ")}`
              );
              process.exit(1);
            }
            auditor = opts.auditor as AuditorVerdict;
          }

          const session = logSession(parseInt(issueId, 10), summary, tokens, auditor, opts.model);
          console.log(`Session logged for issue #${session.issueId} on ${session.createdAt.slice(0, 10)}`);
          if (tokens > 0) console.log(`  Tokens: ${tokens}`);
          if (auditor) console.log(`  Auditor: ${auditor.toUpperCase()}`);
          if (session.model) console.log(`  Model: ${session.model}`);
        } catch (err) {
          console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
          process.exit(1);
        }
      }
    );
}
