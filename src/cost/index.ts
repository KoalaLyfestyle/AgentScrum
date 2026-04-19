import type { CostData } from "./types.js";

export interface CostSource {
  collect(issueId: number, sessionId: string, from: string, to: string): Promise<CostData>;
}

export async function getCostSource(): Promise<CostSource> {
  const mode = process.env["COST_SOURCE"] ?? "manual";
  if (mode === "transcript") {
    const { TranscriptCostSource } = await import("./transcript.js");
    return new TranscriptCostSource();
  }
  const { ManualCostSource } = await import("./manual.js");
  return new ManualCostSource();
}
