# Maintenance

Database location, renumbering, environment variables, and development checks.

## Database location

One setting decides where the SQLite file lives, for the CLI, MCP server, migrations, scripts, and dashboard (`src/db/path.ts`):

- `SCRUM_DB_PATH` is the canonical setting. `AGENTSCRUM_DB_PATH` is accepted as an alias.
- Unset: `<checkout>/agentscrum.db`.
- Relative paths resolve from the AgentScrum checkout, not the working directory.
- If both variables are set to different files, commands stop with an error instead of picking one.

## Renumbering in migration 0014

Epic, sprint, and issue numbers are unique per project (issues: per epic). Before version 0.2, two agents writing at the same moment could get the same number. Migration 0014 gives each later duplicate the next free number and keeps every change in the `renumber_log` table. `npm run db:migrate` prints the changes; if the first CLI or MCP call applies the migration instead, it prints a one-line notice on stderr. Renumbering an epic also changes the keys of its issues (`E01-I05` becomes `E03-I05`), though only the epic row is logged. Back up before upgrading if you wrote keys down.

To read `renumber_log` without changing your data, read a copy. On macOS, `sqlite3 -readonly` fails on a WAL database when the `-wal` and `-shm` files are absent. A `.backup` copy is still in WAL mode, so switch the copy to a rollback journal before reading it:

```bash
sqlite3 agentscrum.db ".backup /tmp/agentscrum-copy.db"
sqlite3 /tmp/agentscrum-copy.db "PRAGMA journal_mode=DELETE;"
sqlite3 -readonly /tmp/agentscrum-copy.db "SELECT * FROM renumber_log"
```

In the container, take a backup (`docker compose run --rm backup`). Container backups are already in rollback-journal mode, so `sqlite3 -readonly backups/<file>.db "SELECT * FROM renumber_log"` works directly.

## Environment variables

The container sets `SCRUM_DB_PATH=/data/agentscrum.db`, `SCRUM_MIGRATE_ON_OPEN=0`, and `COST_SOURCE=manual`.

```bash
SCRUM_DB_PATH=/absolute/path/to/agentscrum.db   # SQLite path (default: <checkout>/agentscrum.db; alias: AGENTSCRUM_DB_PATH)
OBSIDIAN_VAULT_PATH=/path/to/obsidian/vault      # for export-sprint.ts (default: ~/obsidian-vault)
SCRUM_PROJECT_ID=1                               # MCP server / script fallback
SCRUM_MODEL_PRICES='{"claude-sonnet-4-6":3.00}'  # $/1M tokens — enables cost reporting
COST_SOURCE=transcript                           # off | manual (default) | transcript
```

| Variable              | Default            | Description                                                                                                                                                                                                               |
| --------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SCRUM_DB_PATH`       | `<checkout>/agentscrum.db` | SQLite path. Relative values resolve from the checkout. `AGENTSCRUM_DB_PATH` is an alias; conflicting values are an error.                                                                                       |
| `SCRUM_PROJECT_ID`    | —                  | Used by MCP server and scripts; CLI takes project name as first argument                                                                                                                                                  |
| `OBSIDIAN_VAULT_PATH` | `~/obsidian-vault` | Vault root for `export-sprint.ts`                                                                                                                                                                                         |
| `SCRUM_MODEL_PRICES`  | —                  | JSON map of model name → $/1M tokens. When set, `scrum cost` and `scrum_get_cost_report` show estimated dollar figures alongside token counts. When unset, only tokens are shown. Example: `'{"claude-sonnet-4-6":3.00}'` |
| `SCRUM_MIGRATE_ON_OPEN` | on               | `0` stops the CLI and MCP server from applying migrations when they open the database. The MCP server then refuses a missing or out-of-date database. The container sets it. |
| `COST_SOURCE`         | `manual`           | Cost collection mode. `off` — no token tracking. `manual` — agent passes `tokens_used` to `scrum_log_session`. `transcript` — auto-reads tokens from Claude Code JSONL transcripts; requires `scrum_register_session` at session start and `scrum_assign_issue`/`scrum_release_issue` around each issue. |

## Development checks

```bash
npm ci && npm run build && npm test          # root: 113 tests in 11 suites
cd dashboard && npm ci && npm run check && npm test   # dashboard: 16 tests
```

Counts are for Node 24.21.0. On another Node major, two tests in `tests/cli/no-db.test.ts` fail because the CLI prints a Node version warning on stderr. `tests/integration/container-roles.test.ts` runs the container entry point natively. To run the same MCP check against the real container, see [container.md](container.md) and `scripts/mcp-smoke.mjs`.

