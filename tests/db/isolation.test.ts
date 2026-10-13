import { getDbPath } from "../../src/db/index.js";

// Regression: tests/mcp/server.test.ts used to import server.ts, which opened and
// migrated <checkout>/agentscrum.db during `npm test`.
it("tests run against an in-memory database, never the checkout's file", () => {
  expect(getDbPath()).toBe(":memory:");
});
