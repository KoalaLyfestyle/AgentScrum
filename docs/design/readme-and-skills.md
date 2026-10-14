# Design note: a short README and a home for the agent workflow

Status: waiting for Winston to pick an option. Task: #21. Follow-up work: see "Next step".

## Problem

`README.md` is about 500 lines. It mixes four kinds of reader in one page:

- a visitor who wants to know what AgentScrum is and why it is useful
- a person installing it (container or native)
- an agent that needs the session workflow and the tool list
- a maintainer who needs database, environment, and development notes

The pitch is the first two paragraphs, and the agent workflow ("Agent Usage Pattern") starts at line 160. There is no guidance for an agent when the MCP server is not connected, and debug help (`npm run doctor`, database path mismatches) is spread through the install section.

## Constraints

- No content is lost. Every section that leaves the README gets a new home the README links to.
- Few files. Winston does not want skill bloat, so each option says what it costs to maintain.
- The workflow should work without MCP. Today the CLI covers only part of it; see "CLI coverage today".
- Claude Code loads skills from `~/.claude/skills/` or a project's `.claude/skills/`. A skill shipped in this repo needs one install step (copy or symlink) unless AgentScrum later ships as a plugin.

## CLI coverage today

A full CLI fallback is not possible yet. The CLI has `status --json`, `issue list --json`, `issue status <id> <status> -r <reason>`, `issue add`, `log <id> <summary>`, and adding acceptance criteria. These MCP steps have no CLI command:

- `scrum_get_work_package` (the session start)
- `scrum_assign_issue` and `scrum_release_issue` (claim and release)
- `scrum_complete_ac`
- `scrum_complete_dod_item` (`dod` only lists, adds, and removes)
- `scrum_register_session`, `scrum_log_decision`, `scrum_log_lesson`
- `scrum_create_sprint`, `scrum_start_sprint`, `scrum_close_sprint`

`log`, `dod`, `issue show`, and `issue status` also have no `--json`. So any option below can only offer a CLI fallback for the steps the CLI has. The rest needs new CLI commands first, which is separate work. The fallback section should say which steps have no CLI path and to stop and report rather than edit the database.

## Options

### A. One workflow skill, reference in `docs/` (recommended)

- `skills/agentscrum/SKILL.md`: when to use AgentScrum, the session loop (start: work package; during: claim, ACs, blockers; end: status, session log, DoD), the conventions agents must follow (story points, blocker reasons, small issues), a CLI fallback for each MCP step the CLI supports, and a short "when it does not work" section (`npm run doctor`, database path mismatch, migrations off in the container).
- `docs/setup.md` (native install, Node versions, starting fresh), `docs/container.md`, `docs/mcp-tools.md`, `docs/cli.md`, `docs/maintenance.md` (database location, environment variables, development checks, renumbering).
- README: pitch, a 3-command container Quick Start, one example of an agent session, and links. Under 120 lines.
- Cost: 1 skill and 5 docs files. The tool and CLI lists move, they do not grow.

### B. Three small skills, reference in `docs/`

- `agentscrum-plan` (create sprints, groom, estimate), `agentscrum-work` (the session loop), `agentscrum-debug` (doctor, paths, migrations).
- Same `docs/` files and README as A.
- Cost: 3 skills and 5 docs files. Each skill is smaller and triggers more precisely, but conventions and CLI fallbacks repeat across them, and three descriptions have to stay in sync with the tools.

### C. No skill: one agent guide in `docs/`

- `docs/agent-guide.md` holds the workflow, conventions, CLI fallback, and debug notes. Users point their agent at it from their own `CLAUDE.md` or `AGENTS.md`.
- Same reference files and README as A.
- Cost: 0 skills and 6 docs files. Least to maintain and works with any agent, but nothing loads it automatically.

## Recommendation

Option A. One skill covers the whole loop without repeating itself, loads automatically in Claude Code, and the CLI fallback lives next to each MCP step it covers. If AgentScrum later ships as a Claude Code plugin, the same `skills/agentscrum/` folder moves into the plugin unchanged. B is worth it only if planning and working are done by different agents with different prompts; C is the fallback if you would rather not depend on skills at all.

## Where each README section goes (any option)

| Current section | New home |
|---|---|
| Title, pitch paragraphs | README |
| Quick Start (container) | README (short) and `docs/container.md` (full) |
| Native install, Changing Node versions, Starting fresh | `docs/setup.md` |
| Project Selection | `docs/cli.md`, one line in README |
| Issue & Epic Keys | skill (or agent guide), `docs/cli.md` |
| Scrum Conventions | skill (or agent guide) |
| Agent Usage Pattern | skill (or agent guide), one example in README |
| MCP Tools (27) | `docs/mcp-tools.md` |
| CLI Commands | `docs/cli.md` |
| Story Points, Definition of Done | skill (or agent guide) |
| Vault Export | `docs/cli.md` |
| Container | `docs/container.md` |
| Dashboard | `docs/setup.md`, one line in README |
| Database location, Environment Variables, Development checks | `docs/maintenance.md` |
| Stack | README |
| Status, Roadmap | README (short) |

## Next step

Pick A, B, or C (or a change to one) in your review of this PR, for example `/changes option A` or the note on your approval. The follow-up task does the move: README under 120 lines, the chosen skill or guide with CLI fallback steps and a debug section, and every removed section linked from the README.
