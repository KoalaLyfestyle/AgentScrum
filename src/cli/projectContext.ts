import { findProjectByDirectory } from "../services/scrum.js";

/**
 * Shared helper for resolving the current project ID from env.
 * Sources, in order:
 *   1. Explicit project arg:  scrum <project-name> <command>  (index.ts sets the env var)
 *   2. Env var:               SCRUM_PROJECT_ID=1 scrum <command>
 *   3. CWD detection:         scrum <command>  (closest registered project dir)
 *
 * CWD detection runs here, not at startup, so commands that need no project
 * (help, version, init, project list) never open the database for it.
 */
export function requireProjectId(): number {
  let raw = process.env["SCRUM_PROJECT_ID"];
  if (!raw) {
    try {
      const detected = findProjectByDirectory(process.cwd());
      if (detected) {
        raw = String(detected.id);
        process.env["SCRUM_PROJECT_ID"] = raw;
      }
    } catch (err) {
      // A missing database file (#30) gets its own message; anything else falls
      // through to the helpful error below.
      if (err instanceof Error && err.message.startsWith("No database at")) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    }
  }
  if (!raw) {
    console.error(
      [
        "Error: no project selected.",
        "",
        "Options:",
        "  scrum <project-name> <command>   — use project name explicitly",
        "  scrum <project-id>   <command>   — use numeric project ID",
        "  cd into a project directory      — auto-detected if registered with 'scrum init'",
        "",
        "  Run 'scrum project list' to see available projects.",
      ].join("\n")
    );
    process.exit(1);
  }
  const id = parseInt(raw, 10);
  if (Number.isNaN(id)) {
    console.error(`Error: SCRUM_PROJECT_ID must be a valid integer, got "${raw}".`);
    process.exit(1);
  }
  return id;
}
