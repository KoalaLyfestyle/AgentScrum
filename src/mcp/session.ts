import path from "path";
import { readdirSync, statSync } from "fs";
import { homedir } from "os";

/**
 * Auto-discover the current Claude Code session ID from the transcript directory.
 * CC writes JSONL transcripts to ~/.claude/projects/<cwd-with-slashes-as-hyphens>/.
 * The most recently modified .jsonl file is the current session.
 */
export function discoverSessionId(cwd: string, projectsBaseDir?: string): string | undefined {
  try {
    const encoded = cwd.replace(/[/\\]/g, "-");
    const base = projectsBaseDir ?? path.join(homedir(), ".claude", "projects");
    const projectDir = path.join(base, encoded);
    const files = readdirSync(projectDir)
      .filter((f) => f.endsWith(".jsonl"))
      .map((f) => ({ name: f, mtime: statSync(path.join(projectDir, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);
    if (files.length === 0) return undefined;
    return files[0]!.name.replace(/\.jsonl$/, "");
  } catch {
    return undefined;
  }
}
