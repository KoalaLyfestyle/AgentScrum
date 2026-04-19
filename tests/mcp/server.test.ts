import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { discoverSessionId } from "../../src/mcp/server.js";

describe("discoverSessionId", () => {
  const tmpBase = join(tmpdir(), `agentscrum-test-${process.pid}`);
  // Synthetic cwd — does not need to be a real path, just reproducible encoding
  const cwd = "/test/projects/myproject";
  const encoded = cwd.replace(/[/\\]/g, "-");
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
