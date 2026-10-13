import path from "path";
import { fileURLToPath } from "url";

/**
 * Single source of truth for where the AgentScrum SQLite database lives.
 *
 * Canonical setting: SCRUM_DB_PATH.
 * Compatibility alias: AGENTSCRUM_DB_PATH (used by older dashboard setups).
 *
 * Rules:
 * - If neither is set, the database is <project-root>/agentscrum.db.
 * - Relative values resolve against the project root, never the working
 *   directory, so the CLI, MCP server and dashboard always agree.
 * - If both are set and point at different files, fail loudly instead of
 *   silently picking one.
 * - ":memory:" passes through unchanged (tests).
 */

export const CANONICAL_DB_ENV = "SCRUM_DB_PATH";
export const ALIAS_DB_ENV = "AGENTSCRUM_DB_PATH";
export const DEFAULT_DB_FILE = "agentscrum.db";

/** Repo root, derived from this file's location (src/db/ or dist/db/). */
export const PROJECT_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
);

let projectRoot = PROJECT_ROOT;

/** Checkout root used for the default DB, relative paths, and migrations. */
export function getProjectRoot(): string {
  return projectRoot;
}

/**
 * Override the checkout root. Only for hosts that bundle this module (the
 * dashboard's production build), where import.meta.url no longer points here.
 */
export function setProjectRoot(root: string): void {
  projectRoot = path.resolve(root);
}

export class DbPathConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DbPathConfigError";
  }
}

type Env = Record<string, string | undefined>;

function normalise(value: string, projectRoot: string): string {
  if (value === ":memory:") return value;
  return path.resolve(projectRoot, value);
}

export function resolveDbPath(
  env: Env = process.env,
  projectRoot: string = getProjectRoot()
): string {
  const canonical = env[CANONICAL_DB_ENV]?.trim() || undefined;
  const alias = env[ALIAS_DB_ENV]?.trim() || undefined;

  if (canonical && alias) {
    const a = normalise(canonical, projectRoot);
    const b = normalise(alias, projectRoot);
    if (a !== b) {
      throw new DbPathConfigError(
        `${CANONICAL_DB_ENV} and ${ALIAS_DB_ENV} point at different databases:\n` +
          `  ${CANONICAL_DB_ENV}=${a}\n` +
          `  ${ALIAS_DB_ENV}=${b}\n` +
          `Set only ${CANONICAL_DB_ENV} (canonical), or make both the same path.`
      );
    }
    return a;
  }

  const value = canonical ?? alias;
  if (value) return normalise(value, projectRoot);
  return path.join(projectRoot, DEFAULT_DB_FILE);
}
