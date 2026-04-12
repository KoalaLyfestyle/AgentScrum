/**
 * Shared helper for resolving the current project ID from env.
 * The env var is injected by index.ts from either:
 *   1. Explicit project arg:  scrum <project-name> <command>
 *   2. CWD detection:         scrum <command>  (if run inside a registered project dir)
 *   3. Env var:               SCRUM_PROJECT_ID=1 scrum <command>
 */
export function requireProjectId(): number {
  const raw = process.env["SCRUM_PROJECT_ID"];
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
