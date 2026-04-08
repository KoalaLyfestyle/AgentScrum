# AgentScrum

A Scrum management tool purpose-built for agent swarms. Exposes sprint state via an MCP server so any AI agent can read and write issue status natively — without parsing YAML or reading markdown.

## Why

Existing multi-agent frameworks use ad-hoc task lists. AgentScrum brings real Scrum mechanics to agent orchestration: sprints, epics, acceptance criteria, session history, and a PM→Builder→Auditor quality loop. It dogfoods itself from day one — AgentScrum manages its own sprints.

## Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js + TypeScript |
| Database | SQLite via Drizzle ORM |
| Dashboard | SvelteKit |
| ML service | Python + FastAPI |
| Agent interface | MCP server |

## MCP Tools (Sprint 2+)

| Tool | Description |
|------|-------------|
| `scrum_get_current_sprint` | Returns active sprint with all issues and statuses |
| `scrum_get_my_issues` | Returns issues assigned to the calling agent |
| `scrum_update_issue_status` | Transitions an issue status |
| `scrum_log_session` | Appends a session summary to an issue |
| `scrum_add_ac` | Adds an acceptance criterion to an issue |
| `scrum_get_issue_detail` | Full issue detail including ACs and session history |

## Sprint Roadmap

| Sprint | Goal |
|--------|------|
| 1 | Data model + CLI — schema definitions, SQLite migrations, core CLI commands |
| 2 | MCP server — expose sprint state to agents via MCP protocol |
| 3 | SvelteKit dashboard — visual sprint board for human review |
| 4+ | ML cost predictor — token usage forecasting based on issue complexity |

## Development

Sprint 1 is tracked in `.issues.yaml` (pre-MCP bootstrap). Once the MCP server is live in Sprint 2, AgentScrum migrates its own sprint management to the tool.

Sessions follow the PM → Researcher → Builder → Auditor workflow. See `~/Orion/config/workflow/README.md`.
