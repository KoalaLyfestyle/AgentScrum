import { describe, it, expect } from "@jest/globals";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { TranscriptCostSource } from "../../src/cost/transcript.js";
import type { CostData } from "../../src/cost/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(__dirname, "fixtures");

const SESSION_ID = "sample-session";
const WINDOW_START = "2026-04-18T09:30:00.000Z";
const WINDOW_END   = "2026-04-18T10:30:00.000Z";

describe("TranscriptCostSource", () => {
  it("sums tokens only from messages within the claim window", async () => {
    const source = new TranscriptCostSource({ projectsDir: fixtureDir });
    const result: CostData = await source.collect(1, SESSION_ID, WINDOW_START, WINDOW_END);
    // Only the message at 10:00 falls in [09:30, 10:30)
    expect(result.tokensIn).toBe(300);
    expect(result.tokensOut).toBe(150);
    expect(result.cacheRead).toBe(1000);
    expect(result.cacheCreate).toBe(0);
  });

  it("extracts model from the first in-window assistant message that carries it", async () => {
    const source = new TranscriptCostSource({ projectsDir: fixtureDir });
    const result = await source.collect(1, SESSION_ID, WINDOW_START, WINDOW_END);
    expect(result.model).toBe("claude-test-1");
  });

  it("sums costUsd from messages that carry usage.cost", async () => {
    const source = new TranscriptCostSource({ projectsDir: fixtureDir });
    const result = await source.collect(1, SESSION_ID, WINDOW_START, WINDOW_END);
    expect(result.costUsd).toBeCloseTo(0.005);
  });

  it("returns null costUsd when no messages in window carry usage.cost", async () => {
    const source = new TranscriptCostSource({ projectsDir: fixtureDir });
    // Widen the window to include the 11:00 message which has no cost, but
    // the 10:00 message has cost=0.005 so costUsd should still be non-null here.
    // Use a narrow window containing only the 09:00 message (out-of-window) to get null.
    const result = await source.collect(1, SESSION_ID, "2026-04-18T08:00:00.000Z", "2026-04-18T08:59:00.000Z");
    expect(result.costUsd).toBeNull();
  });

  it("returns zeros when no messages fall in the window", async () => {
    const source = new TranscriptCostSource({ projectsDir: fixtureDir });
    const result = await source.collect(1, SESSION_ID, "2026-04-18T12:00:00.000Z", "2026-04-18T13:00:00.000Z");
    expect(result.tokensIn).toBe(0);
    expect(result.tokensOut).toBe(0);
    expect(result.costUsd).toBeNull();
    expect(result.model).toBeUndefined();
  });

  it("returns zeros (no throw) when transcript file does not exist", async () => {
    const source = new TranscriptCostSource({ projectsDir: "/nonexistent/path" });
    const result = await source.collect(1, "no-session", WINDOW_START, WINDOW_END);
    expect(result.tokensIn).toBe(0);
    expect(result.tokensOut).toBe(0);
    expect(result.costUsd).toBeNull();
  });
});
