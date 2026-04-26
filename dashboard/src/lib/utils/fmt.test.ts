import { describe, it, expect } from "vitest";
import { fmt } from "./fmt.js";

describe("fmt.tokens", () => {
  it("returns em-dash for falsy input", () => {
    expect(fmt.tokens(0)).toBe("—");
    expect(fmt.tokens(null)).toBe("—");
    expect(fmt.tokens(undefined)).toBe("—");
  });

  it("formats millions with two decimal places", () => {
    expect(fmt.tokens(1_000_000)).toBe("1.00M");
    expect(fmt.tokens(2_500_000)).toBe("2.50M");
  });

  it("formats thousands with one decimal place", () => {
    expect(fmt.tokens(1_500)).toBe("1.5k");
    expect(fmt.tokens(10_000)).toBe("10.0k");
  });

  it("formats sub-thousand as integer", () => {
    expect(fmt.tokens(999)).toBe("999");
    expect(fmt.tokens(1)).toBe("1");
  });
});

describe("fmt.date", () => {
  it("returns em-dash for falsy input", () => {
    expect(fmt.date(null)).toBe("—");
    expect(fmt.date(undefined)).toBe("—");
  });

  it("formats a valid ISO date string", () => {
    // 1 Jan 2026 — locale-independent check on structure
    const result = fmt.date("2026-01-01T00:00:00.000Z");
    expect(result).toMatch(/Jan/);
    expect(result).toMatch(/26/);
  });
});

describe("fmt.month", () => {
  it("returns em-dash for falsy input", () => {
    expect(fmt.month(null)).toBe("—");
    expect(fmt.month(undefined)).toBe("—");
  });

  it("formats a valid ISO date to short month + year", () => {
    const result = fmt.month("2026-03-15T00:00:00.000Z");
    expect(result).toMatch(/Mar/);
    expect(result).toMatch(/26/);
  });
});

describe("fmt.ago", () => {
  it("returns em-dash for falsy input", () => {
    expect(fmt.ago(null)).toBe("—");
    expect(fmt.ago(undefined)).toBe("—");
  });

  it("returns minutes for recent timestamps", () => {
    const now = new Date();
    const twoMinutesAgo = new Date(now.getTime() - 2 * 60 * 1000).toISOString();
    expect(fmt.ago(twoMinutesAgo)).toBe("2m ago");
  });

  it("returns hours for timestamps within the last day", () => {
    const now = new Date();
    const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString();
    expect(fmt.ago(threeHoursAgo)).toBe("3h ago");
  });

  it("returns days for old timestamps", () => {
    const now = new Date();
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
    expect(fmt.ago(twoDaysAgo)).toBe("2d ago");
  });
});
