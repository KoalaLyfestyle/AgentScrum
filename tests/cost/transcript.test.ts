import { describe, it, expect } from "@jest/globals";
import { join } from "path";
import { TranscriptCostSource } from "../../src/cost/transcript.js";
import type { CostData } from "../../src/cost/types.js";

const fixtureDir = join("/Users/winston/Orion/projects/agentscrum", "tests/cost/fixtures");

const SESSION_ID = "sample-session";
const WINDOW_START = "2026-04-18T09:30:00.000Z";
const WINDOW_END   = "2026-04-18T10:30:00.000Z";

describe("TranscriptCostSource", () => {
  it("sums tokens only from messages within the claim window", async () => {
    const source = new TranscriptCostSource({ projectsDir: fixtureDir });
    const result: CostData = await source.collect(1, SESSION_ID, WINDOW_START, WINDOW_END);
    // Only the message at 10:00 falls in [09:30, 10:30]
    expect(result.tokensIn).toBe(300);
    expect(result.tokensOut).toBe(150);
    expect(result.cacheRead).toBe(1000);
    expect(result.cacheCreate).toBe(0);
  });

  it("returns zeros when no messages fall in the window", async () => {
    const source = new TranscriptCostSource({ projectsDir: fixtureDir });
    const result = await source.collect(1, SESSION_ID, "2026-04-18T12:00:00.000Z", "2026-04-18T13:00:00.000Z");
    expect(result.tokensIn).toBe(0);
    expect(result.tokensOut).toBe(0);
    expect(result.costUsd).toBeNull();
  });

  it("returns zeros (no throw) when transcript file does not exist", async () => {
    const source = new TranscriptCostSource({ projectsDir: "/nonexistent/path" });
    const result = await source.collect(1, "no-session", WINDOW_START, WINDOW_END);
    expect(result.tokensIn).toBe(0);
    expect(result.tokensOut).toBe(0);
    expect(result.costUsd).toBeNull();
  });
});
