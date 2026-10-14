# AgentScrum

Scrum management for agent swarms. Exposes sprint state via an MCP server so any AI agent can manage a full sprint lifecycle — creating projects, epics, sprints, issues, ACs, and logging decisions — without reading files or needing a human PM.

A cold-start agent calls `scrum_get_work_package` with a capacity in story points and receives a complete, fully-briefed task list (title, description, ACs, DoD) in one shot. No cascading reads.

## Quick Start (container)

The container is the supported install path. The image fixes the Node version and the native `better-sqlite3` build, so your own Node setup does not matter. You need Docker (Docker Desktop on macOS).

```bash
git clone https://github.com/KoalaLyfestyle/AgentScrum.git
cd AgentScrum
docker compose up -d --build        # builds the image, runs migrate once, starts the dashboard
curl http://127.0.0.1:5180/healthz  # {"ok":true,"migrations":15}
```

Register the MCP server with Claude Code. Each session starts its own short-lived container on the shared database:

```bash
claude mcp add agentscrum --scope user -- "$PWD/bin/agentscrum-mcp"
```

Use the CLI through Compose. Always name the project: the container cannot see your working directory, so it cannot detect the project from it.

```bash
docker compose run --rm cli init myproject          # once per project
docker compose run --rm cli myproject status
```

The dashboard is at http://127.0.0.1:5180. Data lives in the Docker volume `agentscrum-data` and survives `docker compose restart`, `down`, and rebuilds. `docker compose down -v` deletes it.

Tested platforms: the native install on macOS arm64 and Linux x86_64. The container files are new in this release; see [Container](#container) for what has been checked.

## Native install (Node 24)

Use this if you do not want Docker, or to develop AgentScrum. Requires Node 24 LTS (tested on 24.21.0, pinned in `.nvmrc`). `better-sqlite3` is a native addon, so install, build, and run with the same Node. `npm run doctor` prints the Node path, version, and architecture, and checks that the addon loads.

```bash
# 1. Clone and select the pinned Node
git clone https://github.com/KoalaLyfestyle/AgentScrum.git
cd AgentScrum
nvm install && nvm use       # reads .nvmrc
nvm alias default 24         # the scrum CLI runs with "#!/usr/bin/env node"

# 2. Install, build, and check the runtime
npm ci
npm run build
npm run doctor               # expect "better-sqlite3: OK"; also prints the database path

# 3. Apply DB migrations
npm run db:migrate

# 4. Link the CLI globally (one-time setup)
npm link

# 5. Verify
scrum --version          # 0.2.0
scrum --help             # full command reference
```

> The `scrum` CLI runs TypeScript directly via `tsx` and uses whichever `node` is first on your PATH. If that is not Node 24, the CLI stops with a runtime error. Use `nvm alias default 24`, or run it as `npx tsx src/cli/index.ts <args>` from a Node 24 shell.
> The **MCP server** runs from `dist/` for stability. Run `npm run build` after any server source change, then restart Claude Code.

```bash
# 6. Register the MCP server with Claude Code, from the AgentScrum checkout.
#    It uses the same database the CLI uses by default: <checkout>/agentscrum.db.
claude mcp add agentscrum --scope user \
  -e SCRUM_DB_PATH="$PWD/agentscrum.db" \
  -- "$(nvm which 24.21.0)" "$PWD/dist/mcp/server.js"

# 7. Create your first project: cd into the project you want to track first
cd ~/code/myproject
scrum init myproject         # interactive DoD prompt
# init prints a CLAUDE.md snippet; add it to that project's CLAUDE.md
```

`scrum init` records the current folder as the project's folder. Later, running `scrum` anywhere inside that folder picks the project automatically, so run `init` from the project you are tracking, not from the AgentScrum checkout.

The CLI, the MCP server, `npm run db:migrate`, and the dashboard must use the same database. The simplest setup is the default above. If you want another path, set `SCRUM_DB_PATH` in your shell profile and pass the same absolute path to `claude mcp add`. Avoid setting it only in `<checkout>/.env`: the `scrum` CLI reads that file, but `db:migrate`, the dashboard, and the MCP server do not. `npm run doctor` prints the path from your shell and warns when `.env` gives the CLI a different one; compare it with the `SCRUM_DB_PATH` in your MCP registration (`claude mcp get agentscrum`).

Use absolute paths for the Node binary, `SCRUM_DB_PATH`, and `server.js`. A bare `node` resolves from whatever PATH the client has, which can be a different Node version than the one that built `better-sqlite3`. `--scope user` makes the tools available in every project; the default `local` scope applies to one directory only.

Once registered, all 27 MCP tools are available in every Claude Code session.

### Changing Node versions

The native addon is built for one Node version. After switching (for example, a new Node 24 patch):

```bash
nvm install <version> && nvm use <version>   # also update .nvmrc if you change the pin
npm ci
npm run build
npm run doctor                                # expect "better-sqlite3: OK"
claude mcp remove agentscrum --scope user
claude mcp add agentscrum --scope user \
  -e SCRUM_DB_PATH="$PWD/agentscrum.db" \
  -- "$(nvm which <version>)" "$PWD/dist/mcp/server.js"   # from the checkout, as in step 6
```

### Starting fresh

```bash
mkdir -p ~/agentscrum-old
mv /absolute/path/to/agentscrum.db* ~/agentscrum-old/   # moves the .db, -wal, and -shm files together
scrum init <project>                                    # creates and migrates a new database
```

Then register the MCP server as in step 6 and add the CLAUDE.md snippet that `init` prints to each project.

## Project Selection

The CLI resolves your project in three ways, in order:

1. **Explicit name or ID:** `scrum myproject issue list`
2. **Env var:** `SCRUM_PROJECT_ID=1` (useful in scripts)
3. **CWD auto-detection:** if you `cd` into a project's directory (or a subdirectory), the project is detected automatically — no prefix needed. When projects are nested, the closest one wins.

`--help` and `--version` never open the database.

```bash
# All equivalent when inside ~/projects/myproject/
scrum issue list
scrum myproject issue list
SCRUM_PROJECT_ID=1 scrum issue list
```

## Issue & Epic Keys

Issues are displayed as **E01-I05** (epic number + issue number within that epic). Both numbers are sequential and stable — they don't change as more issues are added.

Epics display as **E01 — CLI & Human UX**.

The underlying numeric `id` is always available in `--json` output for programmatic use.

## Scrum Conventions

These conventions keep the backlog healthy and sprints predictable — for human PMs and agent PMs alike.

**Epics** represent overarching features or product areas (e.g. "MCP Server", "CLI & Human UX"). They are long-lived and continuously developed across multiple sprints. Resist creating a new epic unless the work is genuinely a new product area — most issues belong in an existing one.

**Issues** should be small enough to complete in one agent session. If an issue needs more than ~8 story points, split it. Tightly scoped issues produce cleaner session logs, easier retrospectives, and less wasted context when something goes wrong.

**Story points** express complexity, not time. Use Fibonacci: 1 (trivial), 2 (small), 3 (medium), 5 (large), 8 (very large), 13 (split this). Estimate before starting work, not after.

**Sprint load** is a suggestion, not a contract. A cold-start agent with a full context window might take 20pt; a focused fix session might take 5pt. Pass your actual capacity to `scrum_get_work_package` and trust the prioritization — don't over-commit just to fill the sprint.

**Sprint lifecycle:**

1. **Planning** — create the sprint, assign issues, set story point estimates
2. **Active** — one sprint active at a time; agents pull work via `scrum_get_work_package`
3. **Closed** — run `retro` to surface blockers, incomplete ACs, and expensive issues before planning the next sprint

**Forward planning** — you can create Sprint N+1 and assign issues to it before closing Sprint N. This keeps the backlog groomed and lets human PMs prepare while agents are still working.

**Blocker discipline** — when an issue is blocked, record the reason immediately via `scrum_update_issue_status` with `blocker_reason`. Retrospectives surface blocked issues with their reasons; an empty reason is useless for post-mortems.

---

## Agent Usage Pattern

**Session start** — one call gets everything:

```json
scrum_get_work_package { "project_id": 1, "capacity": 20 }
```

Returns: sprint state, DoD checklist, and fully-briefed issues (title, description, ACs) up to capacity in story points. No follow-up reads needed.

**Session end** — log work and complete DoD:

```json
scrum_update_issue_status { "issue_id": 3, "status": "done" }
scrum_log_session { "issue_id": 3, "summary": "...", "tokens_used": 8400, "auditor": "pass" }
```

## MCP Tools (27)

### Read

| Tool                       | Description                                                                                                                                                                                                                                                         |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scrum_get_current_sprint` | Active sprint + all issues + status summary                                                                                                                                                                                                                         |
| `scrum_get_issue_detail`   | Full issue: ACs, sessions, assignment                                                                                                                                                                                                                               |
| `scrum_get_work_package`   | **One-shot fully-briefed work package.** Pass capacity in story points; returns todo issues in priority order with ACs and DoD embedded. Auto-releases stale claims (>30 min). Pass `agent_id` to include self-claimed issues and exclude issues claimed by others. |
| `scrum_get_retrospective`  | Sprint retrospective: blocked issues (with reasons), done issues with incomplete ACs, high-token issues. Omit `sprint_number` for last closed sprint.                                                                                                               |
| `scrum_get_velocity`       | Velocity data for all closed sprints: story points, issues completed, and total tokens used. Includes per-agent token breakdown when `assigned_to` is set on issues.                                                                                                |
| `scrum_get_cost_report`    | Cost report for a sprint: tokens used and estimated USD cost per issue and sprint total. Requires `SCRUM_MODEL_PRICES` env var for dollar figures; tokens-only otherwise.                                                                                           |

### Project & Sprint

| Tool                  | Description                                         |
| --------------------- | --------------------------------------------------- |
| `scrum_init_project`  | Create project + Sprint 1                           |
| `scrum_create_epic`   | Create an epic                                      |
| `scrum_update_epic`   | Rename an epic                                      |
| `scrum_create_sprint` | Create next sprint (planning)                       |
| `scrum_start_sprint`  | Transition sprint → active                          |
| `scrum_close_sprint`  | Transition sprint → closed                          |
| `scrum_update_sprint` | Update sprint title, goal, PR title, PR description |

### Issues

| Tool                        | Description                                                                                                                     |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `scrum_create_issue`        | Create issue with optional description and story points                                                                         |
| `scrum_update_issue`        | Edit title, description, priority, type, or story point estimate after creation                                                 |
| `scrum_update_issue_status` | Transition issue status                                                                                                         |
| `scrum_assign_issue`        | Assign issue to an agent and atomically claim it. Returns an error if already claimed by a different agent (claim TTL: 30 min). Snapshots CC session ID for cost attribution. |
| `scrum_release_issue`       | Release an issue claim so other agents can pick it up. Sets `released_at` to close the cost window.                            |
| `scrum_register_session`    | Register the Claude Code session ID for cost attribution. Call once at PM phase start. Auto-discovers session ID from transcript directory if no argument given. |

### Acceptance Criteria & Sessions

| Tool                | Description                                                                |
| ------------------- | -------------------------------------------------------------------------- |
| `scrum_add_ac`      | Add acceptance criterion to an issue                                       |
| `scrum_complete_ac` | Mark AC done                                                               |
| `scrum_log_session` | Append session log (summary, tokens, auditor verdict, optional model name). In `COST_SOURCE=transcript` mode, auto-reads tokens and cost from the CC JSONL transcript. |

### Definition of Done

| Tool                      | Description                                                                                                                        |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `scrum_set_dod`           | Replace entire project DoD checklist                                                                                               |
| `scrum_add_dod_item`      | Append a single item to the DoD                                                                                                    |
| `scrum_complete_dod_item` | Mark a DoD item as completed for the specified sprint. Idempotent. Enables `[x]/[ ]` rendering in work_package and `scrum status`. |

### Knowledge

| Tool                 | Description                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------ |
| `scrum_log_decision` | Record an architectural decision (ADR-lite). Include rejected alternatives.                |
| `scrum_log_lesson`   | Record a failure or hard-learned lesson. The `dont_repeat` field is read by future agents. |

## CLI Commands

```
scrum <project> <command> [args]
```

When run from inside a project directory, `<project>` can be omitted.

```bash
# ── Global ──────────────────────────────────────────────────────────────
scrum init <project-name>          # create project + Sprint 1 (interactive DoD prompt)
scrum project list                 # list all projects

# ── Sprint ───────────────────────────────────────────────────────────────
scrum <project> sprint list                     # all sprints with title + status
scrum <project> sprint show <N>                 # full detail for sprint N
scrum <project> sprint show <N> --verbose       # include issue descriptions
scrum <project> sprint issues <N>               # list issues in sprint N (shorthand)
scrum <project> sprint update <N> \
  [--title "Cleanup"] \
  [--goal "..."] \
  [--pr-title "Sprint N: ..."] \
  [--pr-desc "..."]
scrum <project> sprint velocity                 # story points completed per sprint
scrum <project> sprint velocity --tokens        # add token usage column + per-agent breakdown

# ── Status (current sprint summary) ─────────────────────────────────────
scrum <project> status             # sprint summary + active issue + DoD
scrum <project> status --json      # machine-readable JSON

# ── Epics ────────────────────────────────────────────────────────────────
scrum <project> epic list                       # E01, E02... (epics have no status)
scrum <project> epic add <title>               # create a new epic
scrum <project> epic edit <epic-id> --title "New Name"

# ── Epics (extended) ─────────────────────────────────────────────────────
scrum <project> epic show <epic-id>             # all issues in an epic across all sprints

# ── Issues ───────────────────────────────────────────────────────────────
scrum <project> issue list                      # all project issues grouped by epic
scrum <project> issue list --sprint <N>         # sprint-scoped view
scrum <project> issue list --unassigned         # issues not yet assigned to any sprint
scrum <project> issue list --verbose            # include description + ACs inline
scrum <project> issue list --json               # full JSON (for agent consumption)
scrum <project> issue add <epic-id> <title> \
  [--type feature|bugfix|refactor|test|docs] \
  [--priority high|medium|low] \
  [--description "what to build"] \
  [--points 3] \
  [--sprint <N>]                                # omit to create unassigned
scrum <project> issue edit <issue-id> \
  [--title "..."] [--description "..."] \
  [--priority high|medium|low] \
  [--type feature|bugfix|...] [--points 5]
scrum <project> issue status <id> <status>      # todo|in_progress|review|done|blocked
scrum <project> issue status <id> blocked \
  [--reason "why blocked"]                      # prompted interactively if omitted
scrum <project> issue show <id>                 # ACs, sessions, token count, blocker reason
scrum <project> issue ac <id> <text>            # add acceptance criterion

# ── Backlog ───────────────────────────────────────────────────────────────
scrum <project> backlog                         # unassigned issues + planning-sprint issues

# ── Retrospective ─────────────────────────────────────────────────────────
scrum <project> retro [<N>]                     # sprint retro (default: last closed sprint)
scrum <project> retro [<N>] --json              # machine-readable JSON

# ── Cost Report ────────────────────────────────────────────────────────────
scrum <project> cost                            # tokens per issue for active sprint
scrum <project> cost <N>                        # tokens per issue for sprint N
scrum <project> cost --json                     # machine-readable JSON

# ── Definition of Done ───────────────────────────────────────────────────
scrum <project> dod list           # show DoD checklist
scrum <project> dod add "<step>"   # append item
scrum <project> dod remove <id>    # remove item

# ── Session logging ───────────────────────────────────────────────────────
scrum <project> log <issue-id> <summary> [--tokens N] [--auditor pass|fail|skipped]
```

## Story Points

Story points express complexity before work starts. Use Fibonacci: **1** (trivial) · **2** (small) · **3** (medium) · **5** (large) · **8** (very large) · **13** (consider splitting).

Set during sprint planning via `scrum_update_issue { "issue_id": 5, "story_points": 3 }`.

Token actuals (`tokens_used` per issue) are tracked for retrospective cost analysis. Story points are the planning unit; tokens are the forensic unit.

## Definition of Done

Project-wide checklist every agent must complete after finishing an issue. Returned in every `scrum_get_work_package` response so cold-start agents see it automatically.

Set interactively on project init, or at any time:

```bash
scrum myproject dod add "Run npm test"
scrum myproject dod add "Commit changes"
scrum myproject dod add "Push to remote"
```

Or via MCP (for PM agents):

```json
scrum_set_dod { "project_id": 1, "items": ["Run npm test", "Commit", "Push"] }
```

## Vault Export

Exports sprint history, decisions, and lessons to Obsidian. Run at sprint close:

```bash
npx tsx scripts/export-sprint.ts --sprint <N> [--project <id>]
# Env: OBSIDIAN_VAULT_PATH (default: ~/obsidian-vault)
# Writes: projects/<name>/sprints/sprint-N.md, decisions/, lessons/
```

## Container

One image, several roles. `docker/entrypoint.sh` picks the role from the first argument; `compose.yaml` wires them up.

| Role | How it runs | What it does |
|---|---|---|
| `migrate` | `docker compose up` runs it once, first | The only process that changes the schema |
| `dashboard` | Compose service, `127.0.0.1:5180` | Read-only dashboard; `GET /healthz` returns 200 when every migration is applied, 503 with the reason otherwise |
| `mcp` | `bin/agentscrum-mcp`, one container per Claude Code session | MCP over stdio. Does not migrate, and refuses a missing or out-of-date database |
| `cli` | `docker compose run --rm cli <project> <command>` | The `scrum` CLI |
| `backup` | `docker compose run --rm backup` | WAL-safe snapshot into `./backups/` |
| `restore` | `docker compose run --rm restore /backups/<file>.db` | Restores into the separate volume `agentscrum-restore` and checks row counts |
| `import` | see below | Copies an existing database into an empty `agentscrum-data` volume |

Port 5180 is bound to `127.0.0.1` only. It does not clash with Langfuse (3000).

**Move from a native install.** Import your database into a fresh volume before the first `up`:

```bash
mkdir -p backups import
docker compose build
AGENTSCRUM_IMPORT_DIR=/absolute/path/to/folder/with/the/db \
  docker compose run --rm import /import/agentscrum.db   # refuses if the volume already has a database
docker compose up -d                                       # migrate brings the schema up to date
```

The folder is mounted read-only and the source is opened read-only, so the import never changes it. It uses SQLite's online backup API, which includes writes still in the WAL, and checks that every table's row count matches. Close Claude Code sessions that use the database first, so it is not changing during the copy.

**Back up.** Create the folder first, so Docker does not create it as root:

```bash
mkdir -p backups
docker compose run --rm backup          # writes ./backups/agentscrum-<UTC time>.db
```

On Linux the container runs as uid 1000. If your user has another uid, run `sudo chown 1000 backups` once. Backups are standalone files (no `-wal`), safe to copy anywhere.

**Restore a backup.** `restore` writes to the separate volume `agentscrum-restore` and checks that every table's row count matches the backup. It never writes to `agentscrum-data`:

```bash
docker compose run --rm restore /backups/<file>.db
docker run --rm -v agentscrum-restore:/data agentscrum:local counts /data/agentscrum.db
```

To switch to the restored copy, stop everything, keep the old database beside it, and copy the restored one in:

```bash
docker compose down        # also close Claude Code sessions that use AgentScrum
docker run --rm -v agentscrum-restore:/from -v agentscrum-data:/data --entrypoint sh agentscrum:local -c \
  'mkdir -p /data/before-restore && mv /data/agentscrum.db* /data/before-restore/ && cp /from/agentscrum.db /data/agentscrum.db'
docker compose up -d
```

**Limits.**

- `COST_SOURCE=transcript` does not work in the container: it reads Claude Code transcripts under your home folder, which the container cannot see. The container uses `manual`.
- CLI project detection from the working directory does not work in the container; pass the project name.
- MCP runs over stdio only. Each session starts a container, which adds about a second to session start.

**What has been checked.** The roles were run natively through `docker/entrypoint.sh` on Linux x86_64 with Node 24.21.0: migrate, two MCP servers with a claim race (one winner), backup, restore, import, and the production dashboard build with `/healthz`. `npm test` covers this. The image build and `docker compose up` still need a run on a machine with Docker access.

## Dashboard

A read-only SvelteKit web dashboard that reads directly from the AgentScrum SQLite DB.

**Views:** Overview · Live · Sprint Board · All Sprints · Epics · Issues · Velocity · Token Usage · Decisions · Lessons

```bash
# Run the dashboard dev server (port 5173)
npm run dev:dashboard

# Or from dashboard/ directly
cd dashboard && npm run dev
```

The dashboard reads the same database as the CLI and MCP server, using the rules in [Database location](#database-location). It never creates or migrates a database. If the file is missing or not migrated, every page returns 503 with a message that says how to fix it, and `/healthz` returns 503 with the reason. Install the root package (`npm ci` in the repo root) before the dashboard; the dashboard uses the root's `drizzle-orm`.

**URL params:**

| Param | Values | Description |
|-------|--------|-------------|
| `?project=<id>` | integer | Select project (default: first project in DB) |
| `?nav=topbar` | topbar (default) | Show full top nav (standalone mode) |
| `?nav=none` | none | Hide nav entirely (embed mode for Orion main dashboard) |
| `?view=<name>` | overview, live, sprint, sprints, epics, issues, velocity, tokens, decisions, lessons | Active view |

## Database location

One setting decides where the SQLite file lives, for the CLI, MCP server, migrations, scripts, and dashboard (`src/db/path.ts`):

- `SCRUM_DB_PATH` is the canonical setting. `AGENTSCRUM_DB_PATH` is accepted as an alias.
- Unset: `<checkout>/agentscrum.db`.
- Relative paths resolve from the AgentScrum checkout, not the working directory.
- If both variables are set to different files, commands stop with an error instead of picking one.

Epic, sprint, and issue numbers are unique per project (issues: per epic). Before version 0.2, two agents writing at the same moment could get the same number. Migration 0014 gives each later duplicate the next free number and keeps every change in the `renumber_log` table (`sqlite3 agentscrum.db 'SELECT * FROM renumber_log'`). `npm run db:migrate` prints the changes; if the first CLI or MCP call applies the migration instead, it prints a one-line notice on stderr. Renumbering an epic also changes the keys of its issues (`E01-I05` becomes `E03-I05`), though only the epic row is logged. Back up before upgrading if you wrote keys down.

## Environment Variables

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
npm ci && npm run build && npm test          # root: 81 tests in 7 suites
cd dashboard && npm ci && npm run check && npm test   # dashboard: 16 tests
```

Counts are from the last run on Node 24.21.0. `tests/integration/container-roles.test.ts` runs the container entry point natively. To run the same MCP check against the real container, see [Container](#container) and `scripts/mcp-smoke.mjs`.

## Stack

| Layer           | Technology                     |
| --------------- | ------------------------------ |
| Backend         | Node.js + TypeScript           |
| Database        | SQLite via Drizzle ORM         |
| Agent interface | MCP server (stdio, 27 tools)   |
| CLI             | Commander.js (`scrum` command) |
| Dashboard       | SvelteKit + Vite               |

## Status

| Sprint | Goal                                                                          | Status |
| ------ | ----------------------------------------------------------------------------- | ------ |
| 1      | Data model + CLI                                                              | ✓ Done |
| 2      | MCP server                                                                    | ✓ Done |
| 3      | Story points, work package, DoD                                               | ✓ Done |
| 4      | CLI polish, multi-project, edit operations                                    | ✓ Done |
| 5      | Claim locking, token velocity, cost reporting                                 | ✓ Done |
| 6      | Session model tracking, issue lifecycle timestamps, DoD per-sprint completion | ✓ Done |
| 7      | SvelteKit dashboard: overview, sprint board, velocity, tokens, epics, decisions, lessons | ✓ Done |

## Roadmap (Open Issues)

### Near-term

- Multi-agent conflict detection — prevent two agents claiming the same issue simultaneously
- Dashboard build + static export for embedding in other tools
