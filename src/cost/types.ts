export interface CostData {
  tokensIn: number;
  tokensOut: number;
  cacheRead: number;
  cacheCreate: number;
  costUsd: number | null;
  model?: string;
}

export const ZERO_COST: CostData = {
  tokensIn: 0,
  tokensOut: 0,
  cacheRead: 0,
  cacheCreate: 0,
  costUsd: null,
};
