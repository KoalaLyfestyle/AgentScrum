import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { discoverSessionId } from "../../src/mcp/server.js";

describe("discoverSessionId", () => {
  const tmpBase = "/tmp/test-claude-projects";
  const cwd = "/Users/winston/Orion/projects/agentscrum";
  const encoded = cwd.replace(/\//g, "-");
  const projectDir = join(tmpBase, encoded);

  beforeEach(() => {
    mkdirSync(projectDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpBase, { recursive: true, force: true });
  });

  it("returns the stem of the most recently modified jsonl file", () => {
    writeFileSync(join(projectDir, "session-abc.jsonl"), "");
    const result = discoverSessionId(cwd, tmpBase);
    expect(result).toBe("session-abc");
  });

  it("returns undefined when no jsonl files exist", () => {
    const result = discoverSessionId(cwd, tmpBase);
    expect(result).toBeUndefined();
  });

  it("returns undefined when projects directory does not exist", () => {
    const result = discoverSessionId(cwd, "/nonexistent/base");
    expect(result).toBeUndefined();
  });
});
