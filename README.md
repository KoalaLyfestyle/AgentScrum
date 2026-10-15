# AgentScrum

Scrum management for agent swarms. Exposes sprint state via an MCP server so any AI agent can manage a full sprint lifecycle — creating projects, epics, sprints, issues, ACs, and logging decisions — without reading files or needing a human PM.

A cold-start agent calls `scrum_get_work_package` with a capacity in story points and receives a complete, fully-briefed task list (title, description, ACs, DoD) in one shot. No cascading reads.

## Why use it

- **One call to start a session.** The work package holds the sprint goal, the Definition of Done, and every issue the agent can take, with its acceptance criteria.
- **Several agents, one backlog.** Claims stop two agents taking the same issue, and numbers stay unique when agents write at the same time.
- **A record you can review.** Session logs, blocker reasons, decisions, and lessons feed sprint retros, velocity, and token cost, and a read-only dashboard shows them.
- **Works without MCP too.** The `scrum` CLI covers the core steps, and the agent skill says what to do when a step has no CLI command.

## Quick Start (container)

You need Docker (Docker Desktop on macOS) and Claude Code. Run these from a terminal:

```bash
git clone https://github.com/KoalaLyfestyle/AgentScrum.git
cd AgentScrum
docker compose up -d --build                                       # build, migrate, start the dashboard
claude mcp add agentscrum --scope user -- "$PWD/bin/agentscrum-mcp"  # register the MCP server
mkdir -p ~/.claude/skills && ln -s "$PWD/skills/agentscrum" ~/.claude/skills/agentscrum  # install the skill
docker compose run --rm cli init myproject                         # create your first project
```

The dashboard is at http://127.0.0.1:5180. Data lives in the Docker volume `agentscrum-data`. Run the CLI from the checkout as `docker compose run --rm cli myproject <command>`, always naming the project.

The skill is a symlink, so `git pull` keeps it current. It breaks if you move the checkout. To remove it: `rm ~/.claude/skills/agentscrum`.

More: [container.md](docs/container.md) (health check, backup, restore, import, limits) and [setup.md](docs/setup.md) (native install with Node 24, and the dashboard).

To see or undo everything an install changes outside the checkout, read [What installing AgentScrum changes on your machine](docs/setup.md#what-installing-agentscrum-changes-on-your-machine).

## An agent session

```json
scrum_get_work_package { "project_id": 1, "capacity": 20, "agent_id": "builder-1" }
scrum_assign_issue { "issue_id": 3, "agent_id": "builder-1" }
scrum_complete_ac { "ac_id": 7 }
scrum_update_issue_status { "issue_id": 3, "status": "done" }
scrum_log_session { "issue_id": 3, "summary": "...", "tokens_used": 8400, "auditor": "pass" }
scrum_complete_dod_item { "sprint_id": 2, "dod_item_id": 4 }
```

The first call returns the sprint state, the DoD checklist, and fully briefed issues up to the capacity in story points. The full loop, the conventions, the CLI fallback, and debug help are in the [agentscrum skill](skills/agentscrum/SKILL.md).

## Project selection

Name the project (`scrum myproject issue list`), set `SCRUM_PROJECT_ID`, or run `scrum` inside the project's folder, in that order. See [cli.md](docs/cli.md#project-selection).

## Documentation

| Page | What it covers |
|---|---|
| [skills/agentscrum/SKILL.md](skills/agentscrum/SKILL.md) | The agent workflow: session loop, conventions, story points, DoD, CLI fallback, debug |
| [docs/container.md](docs/container.md) | Container install, roles, backup, restore, import, limits |
| [docs/setup.md](docs/setup.md) | Native install (Node 24), changing Node versions, starting fresh, dashboard |
| [docs/mcp-tools.md](docs/mcp-tools.md) | All 27 MCP tools |
| [docs/cli.md](docs/cli.md) | Project selection, issue and epic keys, every CLI command, vault export |
| [docs/maintenance.md](docs/maintenance.md) | Database location, renumbering, environment variables, development checks |

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
- CLI commands for the steps that are MCP only today (#27)
- Dashboard build + static export for embedding in other tools
