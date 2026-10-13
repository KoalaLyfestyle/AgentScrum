// Jest setup: tests must never open the real <checkout>/agentscrum.db.
// Point the DB at an in-memory database; tests that need a file set their own.
process.env.SCRUM_DB_PATH = ":memory:";
delete process.env.AGENTSCRUM_DB_PATH;
