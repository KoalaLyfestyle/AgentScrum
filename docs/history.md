# Build history

AgentScrum was built in sprints, tracked in AgentScrum itself. This table
moved here from the README.

| Sprint | Goal | Status |
|---|---|---|
| 1 | Data model + CLI | Done |
| 2 | MCP server | Done |
| 3 | Story points, work package, DoD | Done |
| 4 | CLI polish, multi-project, edit operations | Done |
| 5 | Claim locking, token velocity, cost reporting | Done |
| 6 | Session model tracking, issue lifecycle timestamps, DoD per-sprint completion | Done |
| 7 | SvelteKit dashboard: overview, sprint board, velocity, tokens, epics, decisions, lessons | Done |

Since October 2026 the work is tracked as GitHub issues instead. Open work:

- Dashboard build and static export for embedding in other tools.

## Stack

| Layer | Technology |
|---|---|
| Backend | Node.js 24 + TypeScript |
| Database | SQLite (better-sqlite3) via Drizzle ORM, WAL mode |
| Agent interface | MCP server over stdio, 27 tools |
| CLI | Commander.js (`scrum` command) |
| Dashboard | SvelteKit + Vite, adapter-node |
| Container | One image (Node 24 on Debian bookworm), several roles |

## Verification and known failures

- **Tests:** on 20 October 2026, on a Mac with Node 24.21.0, 13 suites and 141 of 141 tests pass, plus 16 of 16 dashboard tests.
- **Container:** on 20 October 2026, on a Mac, the image built, `migrate` ran, `/healthz` returned ok, and the two-container MCP smoke test passed with one claim winner.
- **One owner per issue:** `assignIssue` in `src/services/scrum.ts` claims with one conditional `UPDATE ... RETURNING`. `tests/integration/container-roles.test.ts` races two MCP server processes three times and expects exactly one winner each time. A claim older than 30 minutes can be taken over, so a crashed agent does not hold an issue forever.
- **What failed:** after an upgrade, the first open of a database from before migration 0014 by several processes calling `getDb()` at once (the native CLI or MCP server; the container MCP server never migrates) ran the migration in all of them, and the losers crashed with "renumber_log already exists". `migrateRacingOthers` in `src/db/index.ts` now retries, and `tests/db/renumber.test.ts` races six processes five times.
