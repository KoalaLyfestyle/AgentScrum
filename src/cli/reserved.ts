// Words the CLI reads as commands or flags in the first position. `scrum <x> ...`
// treats any other first word as a project name, so a project may never be
// named like one of these (#31). Add every new top-level command here.
export const RESERVED_COMMANDS: ReadonlySet<string> = new Set([
  "init", "project", "epic", "sprint", "issue", "status", "log", "dod", "backlog", "retro", "cost", "help",
  "work", "session", "decision", "lesson",
]);

const RESERVED_FLAGS: ReadonlySet<string> = new Set(["--help", "-h", "--version", "-V"]);

/** True if `scrum <word> ...` reads <word> as a command or flag, not a project. */
export function isReservedWord(word: string): boolean {
  return RESERVED_COMMANDS.has(word) || RESERVED_FLAGS.has(word);
}

/** Why a project name cannot be used on the command line, or null if it can. */
export function projectNameProblem(name: string): string | null {
  if (RESERVED_COMMANDS.has(name)) {
    return `"${name}" is a scrum command, so 'scrum ${name} ...' would run the command, not open the project. Pick another name.`;
  }
  if (name.startsWith("-")) {
    return `"${name}" starts with "-", so the CLI would read it as an option. Pick a name that starts with a letter or digit.`;
  }
  return null;
}
