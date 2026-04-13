import type { Command } from "commander";
import { getRetrospective, listEpics, issueKey } from "../../services/scrum.js";
import { requireProjectId } from "../projectContext.js";
import type { Issue } from "../../schema/types.js";

export function registerRetro(program: Command): void {
  program
    .command("retro [sprint-number]")
    .description("Sprint retrospective summary: blocked issues, incomplete ACs, expensive issues")
    .option("--json", "Output as JSON")
    .action((sprintNumber: string | undefined, opts: { json?: boolean }) => {
      try {
        const pid = requireProjectId();
        const n = sprintNumber !== undefined ? parseInt(sprintNumber, 10) : undefined;
        if (n !== undefined && Number.isNaN(n)) {
          console.error(`Invalid sprint number: "${sprintNumber}"`);
          process.exit(1);
        }
        const retro = getRetrospective(pid, n);

        if (opts.json) {
          console.log(JSON.stringify(retro, null, 2));
          return;
        }

        const title = retro.sprintTitle
          ? `Sprint ${retro.sprintNumber} — ${retro.sprintTitle}`
          : `Sprint ${retro.sprintNumber}`;
        console.log(`\nRetrospective: ${title}\n`);

        const epicsMap = new Map(listEpics(pid).map((e) => [e.id, e]));
        const fmt = (i: Issue) => {
          const epic = epicsMap.get(i.epicId);
          return epic ? issueKey(epic.number, i.number) : `#${i.id}`;
        };

        // --- Blocked issues ---
        console.log(`Blocked Issues (${retro.blockedIssues.length})`);
        if (retro.blockedIssues.length === 0) {
          console.log("  None");
        } else {
          for (const i of retro.blockedIssues) {
            console.log(`  ${fmt(i).padEnd(8)} ${i.title}`);
            if (i.blockerReason) console.log(`           Reason: ${i.blockerReason}`);
          }
        }

        // --- Incomplete AC issues ---
        console.log(`\nDone Issues with Incomplete ACs (${retro.incompleteAcIssues.length})`);
        if (retro.incompleteAcIssues.length === 0) {
          console.log("  None");
        } else {
          for (const i of retro.incompleteAcIssues) {
            console.log(`  ${fmt(i).padEnd(8)} ${i.title}`);
          }
        }

        // --- Expensive issues ---
        console.log(`\nExpensive Issues >2× Median Tokens (${retro.expensiveIssues.length})`);
        if (retro.expensiveIssues.length === 0) {
          console.log("  None");
        } else {
          for (const i of retro.expensiveIssues) {
            console.log(`  ${fmt(i).padEnd(8)} ${i.tokensUsed.toLocaleString()} tokens  ${i.title}`);
          }
        }
        console.log();
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });
}
