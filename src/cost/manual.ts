import type { CostSource } from "./index.js";
import { ZERO_COST } from "./types.js";
import type { CostData } from "./types.js";

export class ManualCostSource implements CostSource {
  async collect(_issueId: number, _sessionId: string, _from: string, _to: string): Promise<CostData> {
    return { ...ZERO_COST };
  }
}
