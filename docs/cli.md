# CLI

The `scrum` command. Natively it is `scrum` after `npm link` ([setup.md](setup.md)). In the container it is `docker compose run --rm cli`, run from the checkout, and you always name the project ([container.md](container.md)):

```bash
scrum myproject issue list                              # native
docker compose run --rm cli myproject issue list        # container
```

## Project selection

The CLI resolves your project in three ways, in order:

1. **Explicit name or ID:** `scrum myproject issue list`
2. **Env var:** `SCRUM_PROJECT_ID=1` (useful in scripts)
3. **CWD auto-detection:** if you `cd` into a project's directory (or a subdirectory), the project is detected automatically — no prefix needed. When projects are nested, the closest one wins.

In the container, working-directory detection does not work, because the container cannot see your working directory. Always name the project.

`--help` and `--version` never open the database.

```bash
# All equivalent when inside ~/projects/myproject/
scrum issue list
scrum myproject issue list
SCRUM_PROJECT_ID=1 scrum issue list
```

## Issue and epic keys

Issues are displayed as **E01-I05** (epic number + issue number within that epic). Both numbers are sequential and stable — they don't change as more issues are added.

Epics display as **E01 — CLI & Human UX**.

The underlying numeric `id` is always available in `--json` output for programmatic use.

Commands take the numeric `id` (for example `scrum myproject issue show 12`), not the key.

## Commands

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
scrum <project> sprint create                   # next sprint, in planning
scrum <project> sprint start <N> [--goal "..."] # planning -> active (no --goal clears the goal)
scrum <project> sprint close <N>                # active -> closed; then run retro

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
scrum <project> issue show <id> [--json]        # ACs, sessions, token count, blocker reason
scrum <project> issue ac <id> <text>            # add acceptance criterion
scrum <project> issue ac-done <ac-id>           # tick an acceptance criterion (its id, from show or work)
scrum <project> issue claim <id> --by <agent> \
  [--session <session-id>]                      # claim; fails if another agent holds it (30 min)
scrum <project> issue release <id> [--by <agent>]  # release; --by refuses another agent's claim

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
scrum <project> dod done <id> [--sprint <N>]   # tick an item for the active (or named) sprint

# ── Session logging ───────────────────────────────────────────────────────
scrum <project> log <issue-id> <summary> [--tokens N] [--auditor pass|fail|skipped] [--model <name>]

# ── Agent workflow (same results as the MCP tools) ──────────────────────
scrum <project> work --capacity <points> [--agent <id>]   # work package (scrum_get_work_package)
scrum session register [--id <session-id>]   # find this folder's Claude Code session ID
scrum <project> decision add "<title>" --context "..." --decision "..." \
  [--rejected "..."] [--consequences "..."]
scrum <project> lesson add "<title>" --what-failed "..." --dont-repeat "..." \
  [--tags a,b] [--global]
```

`--json` prints the same object as the matching MCP tool on `work`, `issue show`, `issue status`, `issue claim`, `issue release`, `issue ac-done`, `dod list`, `dod done`, `sprint create|start|close`, `log`, `session register`, `decision add`, and `lesson add`.

`lesson add` records the lesson for the current project unless you pass `--global`; `scrum_log_lesson` does the opposite, recording it with no project when `project_id` is omitted. Lessons with no project do not appear in work packages yet.

The CLI keeps no state between runs, so `session register` only prints the session ID. Pass it to `issue claim --session <id>` for cost attribution. The project names `work`, `session`, `decision`, and `lesson` are now commands; a project with one of those names can still be reached by its numeric ID.

## Vault export

Exports sprint history, decisions, and lessons to Obsidian. Run at sprint close:

```bash
npx tsx scripts/export-sprint.ts --sprint <N> [--project <id>]
# Env: OBSIDIAN_VAULT_PATH (default: ~/obsidian-vault)
# Writes: projects/<name>/sprints/sprint-N.md, decisions/, lessons/
```

