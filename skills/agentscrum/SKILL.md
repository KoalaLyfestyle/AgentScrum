---
name: agentscrum
description: Workflow for AgentScrum, the Scrum tracker for coding agents. Use when a project tracks its work in AgentScrum, when asked to start a session or get a work package, pick up or claim an issue, plan or close a sprint, groom the backlog, tick acceptance criteria or Definition of Done items, log a session, decision, or lesson, or when any scrum_* MCP tool (scrum_get_work_package, scrum_update_issue_status, scrum_log_session, and the rest) or the scrum CLI is involved.
---

# AgentScrum workflow

AgentScrum keeps sprints, epics, issues, acceptance criteria (ACs), and the Definition of Done (DoD) in one SQLite database. Agents use it through the `scrum_*` MCP tools. The `scrum` CLI is the fallback when the MCP server is not connected.

Reference: [MCP tools](docs/mcp-tools.md), [CLI](docs/cli.md), [setup](docs/setup.md), [container](docs/container.md), [maintenance](docs/maintenance.md).

## Session loop

Find the project ID first. `scrum project list` prints it, and the project's `CLAUDE.md` may name it.

1. **Start.** Get the work package with your capacity in story points:
   `scrum_get_work_package { "project_id": 1, "capacity": 20, "agent_id": "<you>" }`
   It returns the sprint goal, the DoD, and fully briefed issues (title, description, ACs) in priority order. Do not read more before starting. With `COST_SOURCE=transcript`, call `scrum_register_session` once first.
2. **Claim.** Before working on an issue, claim it so no other agent takes it:
   `scrum_assign_issue { "issue_id": 3, "agent_id": "<you>" }`
   An error means another agent holds it. Pick the next issue. Claims expire after 30 minutes.
3. **Work.** Set the issue to `in_progress` with `scrum_update_issue_status`. Tick each AC as you meet it with `scrum_complete_ac { "ac_id": 7 }`.
4. **Blocked.** Set `status: "blocked"` at once, with a `blocker_reason` that says what is missing and who can unblock it. Retros list blocked issues with their reasons, so never leave the reason empty. Release the claim with `scrum_release_issue`.
5. **Finish.** Set the issue to `done` (or `review`), then log the session:
   `scrum_log_session { "issue_id": 3, "summary": "...", "tokens_used": 8400, "auditor": "pass" }`
   Tick each DoD item you completed with `scrum_complete_dod_item { "sprint_id": 2, "dod_item_id": 4 }`, using `sprint.id` and `dod[].id` from the work package. Release the claim.
6. **Record what others need.** A decision with rejected alternatives: `scrum_log_decision`. A failure future agents must not repeat: `scrum_log_lesson` with a concrete `dont_repeat`.

Planning agents also create epics, issues, and sprints (`scrum_create_epic`, `scrum_create_issue`, `scrum_create_sprint`, `scrum_start_sprint`, `scrum_close_sprint`) and read `scrum_get_retrospective` after a sprint closes.

## Conventions

- **Epics** are long-lived product areas (for example "MCP Server", "CLI & Human UX"). Put an issue in an existing epic unless the work is a new product area.
- **Issues** fit in one agent session. If one needs more than about 8 story points, split it. Small issues give cleaner session logs, easier retros, and less wasted context when something goes wrong.
- **Story points** measure complexity, not time, and are set before work starts. Use Fibonacci: 1 (trivial), 2 (small), 3 (medium), 5 (large), 8 (very large), 13 (split this). Set them with `scrum_update_issue { "issue_id": 5, "story_points": 3 }`. Tokens used are tracked separately, for retrospectives.
- **Capacity** is what you can do this session, not what fills the sprint. A cold-start agent with a full context window might take 20 points; a focused fix session might take 5. Pass it honestly to `scrum_get_work_package` and trust its order.
- **Sprint lifecycle:** planning (create the sprint, assign and estimate issues), active (one at a time; agents pull work through the work package), closed (run the retro, `scrum_get_retrospective` or `scrum <project> retro`, to surface blockers, incomplete ACs, and expensive issues before planning the next). You may create sprint N+1 and assign issues to it before closing sprint N, so the backlog stays groomed while agents work.
- **Definition of Done** is a project-wide checklist every agent completes after finishing an issue. It comes with every work package. `scrum init` asks for it; later, replace it with `scrum_set_dod { "project_id": 1, "items": ["Run npm test", "Commit", "Push"] }`, or add one item with `scrum_add_dod_item` or `scrum <project> dod add "Run npm test"`.
- **Keys:** issues display as `E01-I05` (epic 1, issue 5) and epics as `E01 — Title`. Tools and CLI commands take the numeric `id`, which `--json` output and the work package include.

## CLI fallback

Use the CLI only when the `scrum_*` tools are not available. Use the same install as the MCP server, or you read a different database:

- **Container install** (`claude mcp get agentscrum` shows `bin/agentscrum-mcp`): run from the AgentScrum checkout and always name the project:
  `docker compose run --rm cli <project> <command>`
- **Native install** (`claude mcp get agentscrum` shows `node .../dist/mcp/server.js`): `scrum <project> <command>`, run anywhere. A host `scrum` reads `<checkout>/agentscrum.db` (or `SCRUM_DB_PATH`), never the container's `agentscrum-data` volume.

Below, `scrum <project>` stands for either form.

| Step | MCP tool | CLI |
|---|---|---|
| Sprint state and DoD | `scrum_get_current_sprint` | `scrum <project> status --json` |
| List issues with ACs | `scrum_get_issue_detail` | `scrum <project> issue list --json` (add `--sprint <n>` for one sprint) |
| Change status | `scrum_update_issue_status` | `scrum <project> issue status <id> <status>`; for blocked: `scrum <project> issue status <id> blocked -r "<reason>"` (always pass `-r`; without it the CLI waits for input) |
| Create an issue | `scrum_create_issue` | `scrum <project> issue add <epic-id> "<title>" --points <n> --sprint <n> -d "<description>"` |
| Log the session | `scrum_log_session` | `scrum <project> log <id> "<summary>" --tokens <n> --auditor pass` |
| Add an AC | `scrum_add_ac` | `scrum <project> issue ac <id> "<text>"` |

These steps have no CLI command yet (#27 adds them). Without MCP, **stop and report** which step you could not do. Do not edit the database by hand.

- `scrum_get_work_package` (use `status --json` and `issue list --json` to read, but do not treat that as a claim)
- `scrum_assign_issue`, `scrum_release_issue`
- `scrum_complete_ac`
- `scrum_complete_dod_item`
- `scrum_register_session`, `scrum_log_decision`, `scrum_log_lesson`
- `scrum_create_sprint`, `scrum_start_sprint`, `scrum_close_sprint`

## When it does not work

Report what you saw and what you ran. Do not delete or move database files.

- **Runtime check (native).** From the checkout, `npm run doctor` prints the Node version, whether `better-sqlite3` loads (`better-sqlite3: OK` or `FAIL` with a fix), and the database path with its source. Container: `docker run --rm -v agentscrum-data:/data agentscrum:local doctor`, or `curl http://127.0.0.1:5180/healthz`.
- **`better-sqlite3 could not load in this Node runtime`.** The addon was built for another Node. Run with Node 24 (`.nvmrc`), then `npm rebuild better-sqlite3` with that same Node, and point the MCP registration at that Node's absolute path. See [setup](docs/setup.md#changing-node-versions).
- **The CLI and MCP see different data.** They use different databases. Compare `npm run doctor` with `claude mcp get agentscrum`. Natively, both must use the same `SCRUM_DB_PATH` (or neither). A `SCRUM_DB_PATH` set only in `<checkout>/.env` changes the database for the `scrum` CLI only; `npm run doctor` warns about it. Set it in the shell profile instead. A container MCP server reads the `agentscrum-data` volume, so use `docker compose run --rm cli`, not a host `scrum`.
- **`SCRUM_DB_PATH and AGENTSCRUM_DB_PATH point at different databases`.** Both variables are set to different files. Keep only `SCRUM_DB_PATH`, or set both to the same path.
- **`Migrations are off here`.** `SCRUM_MIGRATE_ON_OPEN=0` (the container) or the dashboard found a missing or out-of-date database. Run the migrate step: `docker compose up -d` (container) or `npm run db:migrate` (native).
- **Numbers changed after an upgrade.** Migration 0014 renumbered duplicate epic, sprint, or issue numbers and recorded each change in `renumber_log`. Read it from a copy, as [maintenance](docs/maintenance.md#renumbering-in-migration-0014) shows.
- **`Project not found` or the wrong project.** Name the project explicitly. In the container, working-directory detection does not work. Natively, the closest registered folder wins, and `SCRUM_PROJECT_ID` overrides it. See [project selection](docs/cli.md#project-selection).
