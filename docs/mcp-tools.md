# MCP tools

The MCP server exposes 27 tools. Register it as in [setup.md](setup.md) (native) or [container.md](container.md). The agent workflow that uses them is in [`skills/agentscrum/SKILL.md`](../skills/agentscrum/SKILL.md).

## Tools

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
