import type { Command } from "commander";
import { getCostReport } from "../../services/scrum.js";
import { requireProjectId } from "../projectContext.js";

export function registerCost(program: Command): void {
  program
    .command("cost [sprint-number]")
    .description("Cost report: tokens used (and estimated $ cost) per issue for a sprint")
    .option("--json", "Output as JSON")
    .action((sprintNumber: string | undefined, opts: { json?: boolean }) => {
      try {
        const pid = requireProjectId();
        const n = sprintNumber !== undefined ? parseInt(sprintNumber, 10) : undefined;
        if (n !== undefined && Number.isNaN(n)) {
          console.error(`Invalid sprint number: "${sprintNumber}"`);
          process.exit(1);
        }
        const report = getCostReport(pid, n);

        if (opts.json) {
          console.log(JSON.stringify(report, null, 2));
          return;
        }

        const hasCost = report.totalCost !== undefined;
        const title = report.sprintTitle
          ? `Sprint ${report.sprintNumber} — ${report.sprintTitle}`
          : `Sprint ${report.sprintNumber}`;

        console.log(`\nCost Report: ${title}\n`);

        if (hasCost && report.modelPrices) {
          const models = Object.entries(report.modelPrices)
            .map(([m, p]) => `${m} @ $${p}/1M tokens`)
            .join(", ");
          console.log(`  Pricing: ${models}\n`);
        } else {
          console.log(`  (No SCRUM_MODEL_PRICES set — showing tokens only)\n`);
        }

        // Header
        const header = hasCost
          ? `  ${"Issue".padEnd(10)} ${"Tokens".padStart(10)}   ${"Cost ($)".padStart(10)}   Title`
          : `  ${"Issue".padEnd(10)} ${"Tokens".padStart(10)}   Title`;
        console.log(header);
        console.log(`  ${"-".repeat(hasCost ? 70 : 55)}`);

        for (const issue of report.issues) {
          const tokStr = issue.tokensUsed.toLocaleString().padStart(10);
          if (hasCost) {
            const costStr = issue.estimatedCost !== undefined
              ? `$${issue.estimatedCost.toFixed(4)}`.padStart(10)
              : "        —".padStart(10);
            console.log(`  ${issue.issueKey.padEnd(10)} ${tokStr}   ${costStr}   ${issue.title}`);
          } else {
            console.log(`  ${issue.issueKey.padEnd(10)} ${tokStr}   ${issue.title}`);
          }
        }

        console.log(`  ${"-".repeat(hasCost ? 70 : 55)}`);

        const totalTokStr = report.totalTokens.toLocaleString().padStart(10);
        if (hasCost && report.totalCost !== undefined) {
          const totalCostStr = `$${report.totalCost.toFixed(4)}`.padStart(10);
          console.log(`  ${"TOTAL".padEnd(10)} ${totalTokStr}   ${totalCostStr}`);
        } else {
          console.log(`  ${"TOTAL".padEnd(10)} ${totalTokStr}`);
        }
        console.log();
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });
}
