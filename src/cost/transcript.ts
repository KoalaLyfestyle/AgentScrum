import fs from "fs";
import path from "path";
import os from "os";
import type { CostSource } from "./index.js";
import type { CostData } from "./types.js";
import { ZERO_COST } from "./types.js";

interface TranscriptOptions {
  projectsDir?: string; // override for tests
}

interface AssistantMessage {
  type: "assistant";
  message: {
    model?: string;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_read_input_tokens?: number;
      cache_creation_input_tokens?: number;
      cost?: number;
    };
  };
  timestamp: string;
}

export class TranscriptCostSource implements CostSource {
  private readonly projectsDir: string;

  constructor(options: TranscriptOptions = {}) {
    this.projectsDir =
      options.projectsDir ?? path.join(os.homedir(), ".claude", "projects");
  }

  async collect(
    _issueId: number,
    sessionId: string,
    from: string,
    to: string
  ): Promise<CostData> {
    const transcriptPath = this.resolveTranscriptPath(sessionId);
    if (!transcriptPath) return { ...ZERO_COST };

    try {
      const lines = fs
        .readFileSync(transcriptPath, "utf-8")
        .split("\n")
        .filter(Boolean);
      return this.sumUsageInWindow(lines, from, to);
    } catch {
      process.stderr.write(
        `[agentscrum/cost] warning: could not read transcript ${transcriptPath}\n`
      );
      return { ...ZERO_COST };
    }
  }

  private resolveTranscriptPath(sessionId: string): string | null {
    // When projectsDir is overridden (tests), JSONL lives directly inside it
    const direct = path.join(this.projectsDir, `${sessionId}.jsonl`);
    if (fs.existsSync(direct)) return direct;

    // Real CC path: ~/.claude/projects/<cwd-with-slashes-as-hyphens>/<sessionId>.jsonl
    // Encoding matches discoverSessionId in src/mcp/server.ts
    const encoded = process.cwd().replace(/\//g, "-");
    const hashed = path.join(
      this.projectsDir,
      encoded,
      `${sessionId}.jsonl`
    );
    if (fs.existsSync(hashed)) return hashed;

    return null;
  }

  private sumUsageInWindow(lines: string[], from: string, to: string): CostData {
    let tokensIn = 0,
      tokensOut = 0,
      cacheRead = 0,
      cacheCreate = 0;
    let costUsd: number | null = null;
    let model: string | undefined;

    for (const line of lines) {
      let entry: AssistantMessage;
      try {
        entry = JSON.parse(line) as AssistantMessage;
      } catch {
        continue;
      }
      if (entry.type !== "assistant") continue;
      const ts = entry.timestamp;
      if (!ts || ts < from || ts > to) continue;

      const usage = entry.message?.usage;
      if (!usage) continue;

      tokensIn += usage.input_tokens ?? 0;
      tokensOut += usage.output_tokens ?? 0;
      cacheRead += usage.cache_read_input_tokens ?? 0;
      cacheCreate += usage.cache_creation_input_tokens ?? 0;
      if (usage.cost != null) costUsd = (costUsd ?? 0) + usage.cost;

      // Capture model from the first assistant message with usage (for Task 5 wiring)
      if (!model && entry.message?.model) {
        model = entry.message.model;
      }
    }

    return { tokensIn, tokensOut, cacheRead, cacheCreate, costUsd, model };
  }
}
