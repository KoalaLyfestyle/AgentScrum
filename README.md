# AgentScrum

Scrum management for agent swarms. Exposes sprint state via an MCP server so any AI agent can manage a full sprint lifecycle — creating projects, epics, sprints, issues, ACs, and logging decisions — without reading files or needing a human PM.

A cold-start agent calls `scrum_get_work_package` with a capacity in story points and receives a complete, fully-briefed task list (title, description, ACs, DoD) in one shot. No cascading reads.

## Status

| Sprint | Goal | Status |
|--------|------|--------|
| 1 | Data model + CLI | ✓ Done |
| 2 | MCP server (17 tools) | ✓ Done |
| 3 | Agent-first MVP: story points, work package, DoD | ✓ Done |
| 4 | SvelteKit dashboard | Parked |

## Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js + TypeScript |
| Database | SQLite via Drizzle ORM |
| Agent interface | MCP server (stdio) |
| Dashboard | SvelteKit *(Sprint 4, parked)* |

## Quick Start

```bash
# Install
npm install

# Run DB migrations
npm run db:migrate

# Bootstrap a project via CLI (interactive DoD prompt)
npm run dev -- init myproject

# Register MCP server with Claude Code
claude mcp add agentscrum \
  -e SCRUM_DB_PATH=/path/to/agentscrum.db \
  -e SCRUM_PROJECT_ID=1 \
  -- /path/to/node_modules/.bin/tsx /path/to/src/mcp/server.ts
```

Once registered, all 21 MCP tools are available natively in Claude Code sessions.

## Agent Usage Pattern

**Session start** — one call gets everything:
```json
scrum_get_work_package { "project_id": 1, "capacity": 20 }
```
Returns: sprint state, DoD checklist, and fully-briefed issues (title, description, ACs) up to capacity. No follow-up reads needed.

**Session end** — log work and complete DoD:
```json
scrum_log_session { "issue_id": 3, "summary": "...", "tokens_used": 8400, "auditor": "pass" }
scrum_update_issue_status { "issue_id": 3, "status": "done" }
```

## MCP Tools

### Read
| Tool | Description |
|------|-------------|
| `scrum_get_current_sprint` | Active sprint + all issues + status summary |
| `scrum_get_sprint_summary` | Issue count breakdown by status for a sprint |
| `scrum_get_issue_detail` | Full issue: ACs, sessions, assignment |
| `scrum_get_my_issues` | Issues assigned to a specific agent |
| `scrum_get_work_package` | **One-shot fully-briefed work package.** Pass capacity in story points; returns todo issues in priority order with ACs and DoD embedded. |

### Project & Sprint
| Tool | Description |
|------|-------------|
| `scrum_init_project` | Create project + Sprint 1 |
| `scrum_create_epic` | Create an epic |
| `scrum_create_sprint` | Create next sprint (planning) |
| `scrum_start_sprint` | Transition sprint → active |
| `scrum_close_sprint` | Transition sprint → closed |

### Issues
| Tool | Description |
|------|-------------|
| `scrum_create_issue` | Create issue with optional description and story points |
| `scrum_update_issue_status` | Transition issue status |
| `scrum_assign_issue` | Assign issue to an agent |
| `scrum_estimate_issue` | Set story point estimate (Fibonacci: 1,2,3,5,8,13) |

### Acceptance Criteria & Sessions
| Tool | Description |
|------|-------------|
| `scrum_add_ac` | Add acceptance criterion to an issue |
| `scrum_complete_ac` | Mark AC done |
| `scrum_log_session` | Append session log (summary, tokens, auditor verdict) |

### Definition of Done
| Tool | Description |
|------|-------------|
| `scrum_set_dod` | Replace entire project DoD checklist |
| `scrum_add_dod_item` | Append a single item to the DoD |

### Knowledge
| Tool | Description |
|------|-------------|
| `scrum_log_decision` | Record an architectural decision (ADR-lite). Include rejected alternatives. |
| `scrum_log_lesson` | Record a failure or hard-learned lesson. The `dont_repeat` field is read by future agents. |

## CLI Commands

```bash
scrum init <project>                            # create project + Sprint 1 (interactive DoD prompt)
scrum epic add <project-id> <title>
scrum issue add <epic-id> <title> \
  [--type feature] [--priority high] \
  [--description "requirements body"] \
  [--points 3]
scrum issue list [--full] [--json]             # --full shows ACs, --json outputs structured JSON
scrum issue status <id> <status>
scrum issue show <id>
scrum issue ac <id> <text>
scrum status [--json]
scrum dod list
scrum dod add "<step>"
scrum dod remove <id>
scrum log <issue-id> <summary> [--tokens N] [--auditor pass|fail|skipped]
```

## Story Points

Story points express complexity before work starts. Use Fibonacci: **1** (trivial) · **2** (small) · **3** (medium) · **5** (large) · **8** (very large) · **13** (consider splitting).

Set during sprint planning:
```json
scrum_estimate_issue { "issue_id": 5, "story_points": 3 }
```

Token actuals (`tokens_used` per issue) remain tracked for retrospective cost analysis. Story points are the planning unit; tokens are the forensic unit.

## Definition of Done

Project-wide checklist every agent must complete after finishing an issue. Returned in every `scrum_get_work_package` response so cold-start agents see it automatically.

Set interactively on project init, or at any time:
```bash
SCRUM_PROJECT_ID=1 npx agentscrum dod add "Run npm test"
SCRUM_PROJECT_ID=1 npx agentscrum dod add "Commit changes"
SCRUM_PROJECT_ID=1 npx agentscrum dod add "Push to remote"
```

Or via MCP (for PM agents):
```json
scrum_set_dod { "project_id": 1, "items": ["Run npm test", "Commit", "Push"] }
```

## Vault Export

Exports sprint history, decisions, and lessons to Obsidian. Run at sprint close:

```bash
npx tsx scripts/export-sprint.ts --sprint <N> [--project <id>]
# OBSIDIAN_VAULT_PATH env var (default: ~/Orion/Claude-Workspace)
# Writes: projects/<name>/sprints/sprint-N.md, decisions/, lessons/
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SCRUM_DB_PATH` | `./agentscrum.db` | SQLite file path |
| `SCRUM_PROJECT_ID` | — | Active project ID (CLI + MCP context) |
| `OBSIDIAN_VAULT_PATH` | `~/Orion/Claude-Workspace` | Vault root for export script |

## Roadmap

### Near-term
- Blocked issue reason field — structured blocker description on `blocked` status transition
- `scrum_get_retrospective` — queries blocked issues, failed ACs, high-token issues for sprint summary
- Token velocity per sprint/agent/model — answer "what did this sprint cost?"

### Medium-term
- Multi-agent conflict detection — prevent two agents claiming the same issue simultaneously
- Cost reporting — tokens × model price = sprint $ spend

### Sprint 4+
- SvelteKit sprint board dashboard
- ML cost predictor — forecast token usage from issue complexity
- Burndown chart data endpoint — tokens remaining vs calendar day
- Cross-project lesson search — query lessons by tag across all projects
