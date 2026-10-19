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

- CLI commands for the steps that are MCP only today (#27).
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
