# AgentScrum

Scrum management for agent swarms. Exposes sprint state via an MCP server so any AI agent can manage a full sprint lifecycle — creating projects, epics, sprints, issues, ACs, and logging decisions — without reading files or needing a human PM.

## Status

| Sprint | Goal | Status |
|--------|------|--------|
| 1 | Data model + CLI | ✓ Done |
| 2 | MCP server (15 tools) | ✓ Done |
| 3 | SvelteKit dashboard | Parked |

## Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js + TypeScript |
| Database | SQLite via Drizzle ORM |
| Agent interface | MCP server (stdio) |
| Dashboard | SvelteKit *(Sprint 3)* |

## Quick Start

```bash
# Install
npm install

# Run DB migrations
npm run db:migrate

# Register with Claude Code
claude mcp add agentscrum \
  -e SCRUM_DB_PATH=/path/to/agentscrum.db \
  -e SCRUM_PROJECT_ID=1 \
  -- /path/to/node_modules/.bin/tsx /path/to/src/mcp/server.ts

# Bootstrap a project via CLI
npm run dev -- init myproject
```

Once registered, all 17 MCP tools are available natively in Claude Code sessions.

## MCP Tools

### Read
| Tool | Description |
|------|-------------|
| `scrum_get_current_sprint` | Active sprint + all issues + status summary. Start every session with this. |
| `scrum_get_sprint_summary` | Issue count breakdown by status for a sprint |
| `scrum_get_issue_detail` | Full issue: ACs, sessions, assignment |
| `scrum_get_my_issues` | Issues assigned to a specific agent |

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
| `scrum_create_issue` | Create issue in a sprint |
| `scrum_update_issue_status` | Transition issue status |
| `scrum_assign_issue` | Assign issue to an agent |

### Acceptance Criteria & Sessions
| Tool | Description |
|------|-------------|
| `scrum_add_ac` | Add acceptance criterion to an issue |
| `scrum_complete_ac` | Mark AC done |
| `scrum_log_session` | Append session log (summary, tokens, auditor verdict) |

### Knowledge
| Tool | Description |
|------|-------------|
| `scrum_log_decision` | Record an architectural decision (ADR-lite). Include rejected alternatives. |
| `scrum_log_lesson` | Record a failure or hard-learned lesson. The `dont_repeat` field is read by future agents. |

## CLI Commands

```bash
scrum init <project>          # create project + Sprint 1
scrum epic add <project-id> <title>
scrum issue add <epic-id> <title> [--type feature] [--priority high]
scrum issue list
scrum issue status <id> <status>
scrum issue show <id>
scrum issue ac <id> <text>
scrum status
scrum log <issue-id> <summary> [--tokens N] [--auditor pass|fail|skipped]
```

## Vault Export

Exports sprint history, decisions, and lessons to Obsidian. Run at sprint close:

```bash
npx tsx scripts/export-sprint.ts --sprint <N> [--project <id>]
# OBSIDIAN_VAULT_PATH env var (default: ~/Orion/Claude-Workspace)
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SCRUM_DB_PATH` | `./agentscrum.db` | SQLite file path |
| `SCRUM_PROJECT_ID` | — | Active project ID (MCP server context) |
| `OBSIDIAN_VAULT_PATH` | `~/Orion/Claude-Workspace` | Vault root for export script |

## Roadmap

### Sprint 3 (parked — evaluating UI approach)
- SvelteKit sprint board dashboard

### Near-term
- Blocked issue reason field — structured blocker description on `blocked` status transition
- `scrum_get_retrospective` — queries blocked issues, failed ACs, high-token issues for sprint summary
- Obsidian vault sync improvements

### Medium-term
- Token velocity tracking — tokens per sprint/agent/model; answer "what did this sprint cost?"
- Story point estimation — agent self-estimates token cost before picking up an issue
- Multi-agent conflict detection — prevent two agents claiming the same issue simultaneously
- Cost reporting — tokens × model price = sprint $ spend

### Sprint 4+
- ML cost predictor — forecast token usage from issue complexity (text embeddings → regression)
- Burndown chart data endpoint — tokens remaining vs calendar day
- Cross-project lesson search — query lessons by tag across all projects
