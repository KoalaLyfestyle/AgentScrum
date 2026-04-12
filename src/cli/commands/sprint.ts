import type { Command } from "commander";
import { listSprints, updateSprint, getVelocity } from "../../services/scrum.js";

function projectId(): number {
  const raw = process.env["SCRUM_PROJECT_ID"];
  if (!raw) {
    console.error("Error: SCRUM_PROJECT_ID env var is required (use 'scrum <project> sprint ...')");
    process.exit(1);
  }
  return parseInt(raw, 10);
}

export function registerSprint(program: Command): void {
  const sprint = program.command("sprint").description("Manage sprints");

  sprint
    .command("list")
    .description("List all sprints for the current project")
    .option("--json", "Output as JSON")
    .action((opts: { json?: boolean }) => {
      try {
        const sprints = listSprints(projectId());
        if (opts.json) {
          console.log(JSON.stringify(sprints, null, 2));
          return;
        }
        if (sprints.length === 0) {
          console.log("No sprints found.");
          return;
        }
        console.log(`Sprints (${sprints.length}):\n`);
        for (const s of sprints) {
          const status = s.status.padEnd(8);
          const title = s.title ? ` — ${s.title}` : "";
          const goal = s.goal ? `  ${s.goal.length > 60 ? s.goal.slice(0, 57) + "..." : s.goal}` : "";
          console.log(`  Sprint ${s.number}${title}  [${status}]${goal}`);
          if (s.prTitle) console.log(`    PR: ${s.prTitle}`);
        }
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });

  sprint
    .command("update <sprint-number>")
    .description("Update a sprint's title, goal, or PR fields")
    .option("--title <text>", "Human-readable sprint name, e.g. 'Cleanup & Polish'")
    .option("--goal <text>", "Sprint goal")
    .option("--pr-title <text>", "PR title for the sprint branch merge")
    .option("--pr-desc <text>", "PR description / merge commit body")
    .option("--json", "Output updated sprint as JSON")
    .action((sprintNumber: string, opts: { title?: string; goal?: string; prTitle?: string; prDesc?: string; json?: boolean }) => {
      try {
        const allSprints = listSprints(projectId());
        const sprint = allSprints.find((s) => s.number === parseInt(sprintNumber, 10));
        if (!sprint) {
          console.error(`Sprint ${sprintNumber} not found`);
          process.exit(1);
        }
        const patch: Parameters<typeof updateSprint>[1] = {};
        if (opts.title !== undefined) patch.title = opts.title;
        if (opts.goal !== undefined) patch.goal = opts.goal;
        if (opts.prTitle !== undefined) patch.prTitle = opts.prTitle;
        if (opts.prDesc !== undefined) patch.prDescription = opts.prDesc;
        if (Object.keys(patch).length === 0) {
          console.error("Error: specify at least one field (--title, --goal, --pr-title, --pr-desc)");
          process.exit(1);
        }
        const updated = updateSprint(sprint.id, patch);
        if (opts.json) {
          console.log(JSON.stringify(updated, null, 2));
          return;
        }
        const label = updated.title ? `Sprint ${updated.number} — ${updated.title}` : `Sprint ${updated.number}`;
        console.log(`Updated: ${label}  [${updated.status}]`);
        if (updated.goal) console.log(`  Goal: ${updated.goal}`);
        if (updated.prTitle) console.log(`  PR title: ${updated.prTitle}`);
        if (updated.prDescription) console.log(`  PR desc: ${updated.prDescription}`);
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });

  sprint
    .command("velocity")
    .description("Show story point velocity for closed sprints")
    .option("--json", "Output as JSON")
    .action((opts: { json?: boolean }) => {
      try {
        const velocity = getVelocity(projectId());
        if (opts.json) {
          console.log(JSON.stringify(velocity, null, 2));
          return;
        }
        if (velocity.length === 0) {
          console.log("No closed sprints yet — velocity data will appear after the first sprint closes.");
          return;
        }
        console.log(`Velocity by sprint:\n`);
        for (const v of velocity) {
          const label = v.sprintTitle ? `Sprint ${v.sprintNumber} — ${v.sprintTitle}` : `Sprint ${v.sprintNumber}`;
          console.log(`  ${label}:  ${v.pointsCompleted} pts  (${v.issuesCompleted} issues done)`);
        }
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });
}
