import type { Command } from "commander";
import { listSprints, listIssues, listEpics, updateSprint, getVelocity, getSprintByNumber, issueKey } from "../../services/scrum.js";
import { requireProjectId } from "../projectContext.js";

export function registerSprint(program: Command): void {
  const sprint = program.command("sprint").description("Manage sprints");

  sprint
    .command("list")
    .description("List all sprints for the current project")
    .option("--json", "Output as JSON")
    .action((opts: { json?: boolean }) => {
      try {
        const sprints = listSprints(requireProjectId());
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
        const n = parseInt(sprintNumber, 10);
        if (Number.isNaN(n)) {
          console.error(`Error: invalid sprint number "${sprintNumber}"`);
          process.exit(1);
        }
        const allSprints = listSprints(requireProjectId());
        const sprint = allSprints.find((s) => s.number === n);
        if (!sprint) {
          console.error(`Sprint ${n} not found`);
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
    .command("show <sprint-number>")
    .description("Show full detail for a specific sprint: status, goal, all issues")
    .option("-V, --verbose", "Include issue descriptions")
    .option("--json", "Output as JSON")
    .action((sprintNumber: string, opts: { verbose?: boolean; json?: boolean }) => {
      try {
        const pid = requireProjectId();
        const sn = parseInt(sprintNumber, 10);
        if (Number.isNaN(sn)) {
          console.error(`Error: invalid sprint number "${sprintNumber}"`);
          process.exit(1);
        }
        const sprint = getSprintByNumber(pid, sn);
        const issues = listIssues(sprint.id);
        if (opts.json) {
          console.log(JSON.stringify({ sprint, issues }, null, 2));
          return;
        }
        const label = sprint.title ? `Sprint ${sprint.number} — ${sprint.title}` : `Sprint ${sprint.number}`;
        console.log(`\n${label}  [${sprint.status.toUpperCase()}]`);
        if (sprint.goal) console.log(`Goal: ${sprint.goal}`);
        if (sprint.startedAt) console.log(`Started: ${sprint.startedAt.slice(0, 10)}`);
        if (sprint.closedAt) console.log(`Closed:  ${sprint.closedAt.slice(0, 10)}`);
        if (sprint.prTitle) console.log(`PR: ${sprint.prTitle}`);
        console.log(`\nIssues (${issues.length}):`);
        if (issues.length === 0) {
          console.log("  (none)");
        } else {
          const epicsMap = new Map(listEpics(pid).map((e) => [e.id, e]));
          for (const i of issues) {
            const epic = epicsMap.get(i.epicId);
            const key = epic ? issueKey(epic.number, i.number) : `#${i.id}`;
            const status = i.status.padEnd(11);
            const pts = i.storyPoints ? ` [${i.storyPoints}pt]` : "";
            console.log(`  ${key.padEnd(8)} [${status}]${pts} ${i.title}`);
            if (opts.verbose && i.description) console.log(`           ${i.description}`);
          }
        }
        console.log();
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });

  sprint
    .command("velocity")
    .description("Show story point velocity for closed sprints")
    .option("--tokens", "Include token usage column and per-agent breakdown")
    .option("--json", "Output as JSON")
    .action((opts: { tokens?: boolean; json?: boolean }) => {
      try {
        const velocity = getVelocity(requireProjectId());
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
          const tokenPart = opts.tokens ? `  ${v.tokensUsed.toLocaleString()} tokens` : "";
          console.log(`  ${label}:  ${v.pointsCompleted} pts  (${v.issuesCompleted} issues done)${tokenPart}`);
          if (opts.tokens && v.tokensByAgent) {
            for (const [agent, tokens] of Object.entries(v.tokensByAgent)) {
              console.log(`    ${agent}: ${tokens.toLocaleString()} tokens`);
            }
          }
        }
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });

  sprint
    .command("issues <sprint-number>")
    .description("List all issues in a specific sprint")
    .option("-V, --verbose", "Include description + ACs for each issue")
    .option("--json", "Output as JSON")
    .action((sprintNumber: string, opts: { verbose?: boolean; json?: boolean }) => {
      try {
        const pid = requireProjectId();
        const sn = parseInt(sprintNumber, 10);
        if (Number.isNaN(sn)) {
          console.error(`Error: invalid sprint number "${sprintNumber}"`);
          process.exit(1);
        }
        const sprintObj = getSprintByNumber(pid, sn);
        const issues = listIssues(sprintObj.id);
        if (opts.json) {
          console.log(JSON.stringify({ sprint: sprintObj, issues }, null, 2));
          return;
        }
        const label = sprintObj.title ? `Sprint ${sprintObj.number} — ${sprintObj.title}` : `Sprint ${sprintObj.number}`;
        console.log(`${label}  [${sprintObj.status.toUpperCase()}]  ${issues.length} issue(s):\n`);
        if (issues.length === 0) {
          console.log("  (none)");
          return;
        }
        const epicsMap = new Map(listEpics(pid).map((e) => [e.id, e]));
        for (const i of issues) {
          const epic = epicsMap.get(i.epicId);
          const key = epic ? issueKey(epic.number, i.number) : `#${i.id}`;
          const status = i.status.padEnd(11);
          const pts = i.storyPoints ? ` [${i.storyPoints}pt]` : "";
          console.log(`  ${key.padEnd(8)} [${status}]${pts} ${i.title}`);
          if (opts.verbose && i.description) console.log(`           ${i.description}`);
        }
        console.log();
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });
}
