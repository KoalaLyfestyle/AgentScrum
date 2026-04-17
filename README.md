# AgentScrum

Scrum management for agent swarms. Exposes sprint state via an MCP server so any AI agent can manage a full sprint lifecycle — creating projects, epics, sprints, issues, ACs, and logging decisions — without reading files or needing a human PM.

A cold-start agent calls `scrum_get_work_package` with a capacity in story points and receives a complete, fully-briefed task list (title, description, ACs, DoD) in one shot. No cascading reads.

## Status

| Sprint | Goal | Status |
|--------|------|--------|
| 1 | Data model + CLI | ✓ Done |
| 2 | MCP server | ✓ Done |
| 3 | Story points, work package, DoD | ✓ Done |
| 4 | CLI polish, multi-project, edit operations | ✓ Done |
| 5 | Claim locking, token velocity, cost reporting | ✓ Done |
| 6 | Session model tracking, issue lifecycle timestamps, DoD per-sprint completion | ✓ Done |

## Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js + TypeScript |
| Database | SQLite via Drizzle ORM |
| Agent interface | MCP server (stdio, 26 tools) |
| CLI | Commander.js (`scrum` command) |

## Quick Start

```bash
# 1. Clone and install
git clone https://github.com/KoalaLyfestyle/AgentScrum.git
cd AgentScrum
npm install

# 2. Apply DB migrations
npm run db:migrate

# 3. Link the CLI globally (one-time setup)
npm link

# 4. Verify
scrum --version          # 0.1.0
scrum --help             # full command reference
```

> **No build step required.** The `scrum` command runs TypeScript directly via `tsx`.
> If you don't want to use `npm link`, every command also works as `npx tsx src/cli/index.ts <args>`.

```bash
# 5. Create your first project (interactive DoD prompt)
scrum init myproject

# 6. Register the MCP server with Claude Code
claude mcp add agentscrum \
  -e SCRUM_DB_PATH=/absolute/path/to/agentscrum.db \
  -- /absolute/path/to/node_modules/.bin/tsx /absolute/path/to/src/mcp/server.ts
```

> `tsx` is a dev dependency — it's available at `node_modules/.bin/tsx` after `npm install`. No separate global install needed. Use the **absolute path** to the binary since Claude Code may not inherit your shell's `PATH`.

Once registered, all 25 MCP tools are available in every Claude Code session.

## Project Selection

The CLI resolves your project in three ways, in order:

1. **Explicit name or ID:** `scrum myproject issue list`
2. **CWD auto-detection:** if you `cd` into a project's directory (or a subdirectory), the project is detected automatically — no prefix needed
3. **Env var fallback:** `SCRUM_PROJECT_ID=1` (useful in scripts)

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

## MCP Tools (26)

### Read
| Tool | Description |
|------|-------------|
| `scrum_get_current_sprint` | Active sprint + all issues + status summary |
| `scrum_get_issue_detail` | Full issue: ACs, sessions, assignment |
| `scrum_get_work_package` | **One-shot fully-briefed work package.** Pass capacity in story points; returns todo issues in priority order with ACs and DoD embedded. Auto-releases stale claims (>30 min). Pass `agent_id` to include self-claimed issues and exclude issues claimed by others. |
| `scrum_get_retrospective` | Sprint retrospective: blocked issues (with reasons), done issues with incomplete ACs, high-token issues. Omit `sprint_number` for last closed sprint. |
| `scrum_get_velocity` | Velocity data for all closed sprints: story points, issues completed, and total tokens used. Includes per-agent token breakdown when `assigned_to` is set on issues. |
| `scrum_get_cost_report` | Cost report for a sprint: tokens used and estimated USD cost per issue and sprint total. Requires `SCRUM_MODEL_PRICES` env var for dollar figures; tokens-only otherwise. |

### Project & Sprint
| Tool | Description |
|------|-------------|
| `scrum_init_project` | Create project + Sprint 1 |
| `scrum_create_epic` | Create an epic |
| `scrum_update_epic` | Rename an epic |
| `scrum_create_sprint` | Create next sprint (planning) |
| `scrum_start_sprint` | Transition sprint → active |
| `scrum_close_sprint` | Transition sprint → closed |
| `scrum_update_sprint` | Update sprint title, goal, PR title, PR description |

### Issues
| Tool | Description |
|------|-------------|
| `scrum_create_issue` | Create issue with optional description and story points |
| `scrum_update_issue` | Edit title, description, priority, type, or story point estimate after creation |
| `scrum_update_issue_status` | Transition issue status |
| `scrum_assign_issue` | Assign issue to an agent and atomically claim it. Returns an error if already claimed by a different agent (claim TTL: 30 min). |
| `scrum_release_issue` | Release an issue claim so other agents can pick it up. |

### Acceptance Criteria & Sessions
| Tool | Description |
|------|-------------|
| `scrum_add_ac` | Add acceptance criterion to an issue |
| `scrum_complete_ac` | Mark AC done |
| `scrum_log_session` | Append session log (summary, tokens, auditor verdict, optional model name) |

### Definition of Done
| Tool | Description |
|------|-------------|
| `scrum_set_dod` | Replace entire project DoD checklist |
| `scrum_add_dod_item` | Append a single item to the DoD |
| `scrum_complete_dod_item` | Mark a DoD item as completed for the specified sprint. Idempotent. Enables `[x]/[ ]` rendering in work_package and `scrum status`. |

### Knowledge
| Tool | Description |
|------|-------------|
| `scrum_log_decision` | Record an architectural decision (ADR-lite). Include rejected alternatives. |
| `scrum_log_lesson` | Record a failure or hard-learned lesson. The `dont_repeat` field is read by future agents. |

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

## Environment Variables

```bash
SCRUM_DB_PATH=/absolute/path/to/agentscrum.db   # SQLite path (default: ./agentscrum.db)
OBSIDIAN_VAULT_PATH=/path/to/obsidian/vault      # for export-sprint.ts (default: ~/obsidian-vault)
SCRUM_PROJECT_ID=1                               # MCP server / script fallback
SCRUM_MODEL_PRICES='{"claude-sonnet-4-6":3.00}'  # $/1M tokens — enables cost reporting
```

| Variable | Default | Description |
|----------|---------|-------------|
| `SCRUM_DB_PATH` | `./agentscrum.db` | SQLite path — use absolute path so CLI works from any directory |
| `SCRUM_PROJECT_ID` | — | Used by MCP server and scripts; CLI takes project name as first argument |
| `OBSIDIAN_VAULT_PATH` | `~/obsidian-vault` | Vault root for `export-sprint.ts` |
| `SCRUM_MODEL_PRICES` | — | JSON map of model name → $/1M tokens. When set, `scrum cost` and `scrum_get_cost_report` show estimated dollar figures alongside token counts. When unset, only tokens are shown. Example: `'{"claude-sonnet-4-6":3.00}'` |

## Roadmap

### Near-term
- Blocked issue reason field — structured blocker description on `blocked` status transition
- `scrum_get_retrospective` — queries blocked issues, failed ACs, high-token issues for sprint summary
- Token velocity per sprint/agent/model + cost reporting (`scrum_get_velocity`, `scrum_get_cost_report`, `scrum cost`)

### Medium-term
- Multi-agent conflict detection — prevent two agents claiming the same issue simultaneously
- Cost reporting — tokens × model price = sprint $ spend
- SvelteKit sprint board dashboard
