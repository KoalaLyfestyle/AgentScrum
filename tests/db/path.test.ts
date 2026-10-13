import path from "path";
import { fileURLToPath } from "url";
import {
  resolveDbPath,
  PROJECT_ROOT,
  DbPathConfigError,
} from "../../src/db/path.js";

const root = "/opt/agentscrum";

describe("resolveDbPath", () => {
  it("defaults to <project-root>/agentscrum.db", () => {
    expect(resolveDbPath({}, root)).toBe("/opt/agentscrum/agentscrum.db");
  });

  it("default project root is the checkout, not the working directory", () => {
    expect(PROJECT_ROOT).toBe(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.."));
    const cwd = process.cwd();
    try {
      process.chdir("/");
      expect(resolveDbPath({})).toBe(path.join(PROJECT_ROOT, "agentscrum.db"));
    } finally {
      process.chdir(cwd);
    }
  });

  it("uses SCRUM_DB_PATH (canonical)", () => {
    expect(resolveDbPath({ SCRUM_DB_PATH: "/data/a.db" }, root)).toBe("/data/a.db");
  });

  it("accepts AGENTSCRUM_DB_PATH as an alias", () => {
    expect(resolveDbPath({ AGENTSCRUM_DB_PATH: "/data/b.db" }, root)).toBe("/data/b.db");
  });

  // Regression: the dashboard used '../agentscrum.db' relative to its CWD, so it
  // could open (and create) a different, empty database from the CLI.
  it("resolves relative paths from the project root, not the CWD", () => {
    expect(resolveDbPath({ AGENTSCRUM_DB_PATH: "../agentscrum.db" }, root)).toBe(
      "/opt/agentscrum.db"
    );
    expect(resolveDbPath({ SCRUM_DB_PATH: "data/x.db" }, root)).toBe(
      "/opt/agentscrum/data/x.db"
    );
  });

  it("accepts both when they point at the same file", () => {
    expect(
      resolveDbPath(
        { SCRUM_DB_PATH: "/opt/agentscrum/agentscrum.db", AGENTSCRUM_DB_PATH: "agentscrum.db" },
        root
      )
    ).toBe("/opt/agentscrum/agentscrum.db");
  });

  it("refuses two different databases", () => {
    expect(() =>
      resolveDbPath({ SCRUM_DB_PATH: "/a.db", AGENTSCRUM_DB_PATH: "/b.db" }, root)
    ).toThrow(DbPathConfigError);
  });

  it("ignores empty values and passes :memory: through", () => {
    expect(resolveDbPath({ SCRUM_DB_PATH: "  ", AGENTSCRUM_DB_PATH: "" }, root)).toBe(
      "/opt/agentscrum/agentscrum.db"
    );
    expect(resolveDbPath({ SCRUM_DB_PATH: ":memory:" }, root)).toBe(":memory:");
  });
});
