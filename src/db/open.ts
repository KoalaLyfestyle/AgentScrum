import Database from "better-sqlite3";

/** Node major version this repo is tested against. Keep in sync with .nvmrc. */
export const SUPPORTED_NODE_MAJOR = 24;

function runtimeSummary(): string {
  return (
    `  node:     ${process.execPath}\n` +
    `  version:  ${process.version} (ABI ${process.versions.modules})\n` +
    `  platform: ${process.platform}-${process.arch}`
  );
}

/** One stderr line if the running Node major differs from the tested one. */
export function warnIfUnsupportedNode(): void {
  const major = Number(process.versions.node.split(".")[0]);
  if (major !== SUPPORTED_NODE_MAJOR) {
    process.stderr.write(
      `[agentscrum] warning: tested on Node ${SUPPORTED_NODE_MAJOR}.x LTS, running ${process.version} ` +
        `(${process.execPath}). See .nvmrc.\n`
    );
  }
}

function isNativeLoadError(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | null;
  const msg = e?.message ?? "";
  return (
    e?.code === "ERR_DLOPEN_FAILED" ||
    /NODE_MODULE_VERSION|was compiled against a different Node\.js version|invalid ELF header|wrong architecture|incompatible architecture|Could not locate the bindings file/i.test(
      msg
    )
  );
}

/**
 * Open the SQLite file. If better-sqlite3's native addon cannot load in this
 * Node runtime, throw an error that says which runtime was used and how to fix it.
 */
export function openSqlite(
  dbPath: string,
  options?: Database.Options
): Database.Database {
  try {
    return new Database(dbPath, options);
  } catch (err) {
    if (!isNativeLoadError(err)) throw err;
    const original = (err as Error).message.split("\n")[0];
    const wrapped = new Error(
      `better-sqlite3 could not load in this Node runtime.\n` +
        runtimeSummary() +
        `\n  cause:    ${original}\n` +
        `Fix: run the CLI/MCP server with Node ${SUPPORTED_NODE_MAJOR}.x (see .nvmrc), then ` +
        `rebuild the addon with that same Node:\n` +
        `  cd <agentscrum checkout> && npm rebuild better-sqlite3\n` +
        `If an MCP client starts the server, point it at the same node binary ` +
        `(e.g. claude mcp add agentscrum /path/to/node24/bin/node /path/to/dist/mcp/server.js).`
    );
    (wrapped as Error & { cause?: unknown }).cause = err;
    throw wrapped;
  }
}
