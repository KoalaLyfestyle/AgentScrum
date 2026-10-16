# Setup

The container is the supported install path; see [container.md](container.md). This page covers the native install, Node version changes, starting fresh, and the dashboard.

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

# 7. Install the agent workflow skill (user scope, as a symlink), from the checkout.
#    If ~/.claude/skills/agentscrum already exists, remove it first.
mkdir -p ~/.claude/skills
ln -s "$PWD/skills/agentscrum" ~/.claude/skills/agentscrum

# 8. Create your first project: cd into the project you want to track first
cd ~/code/myproject
scrum init myproject         # interactive DoD prompt
# init prints a CLAUDE.md snippet; add it to that project's CLAUDE.md if you want it
```

`scrum init` records the current folder as the project's folder. Later, running `scrum` anywhere inside that folder picks the project automatically, so run `init` from the project you are tracking, not from the AgentScrum checkout.

The skill is a symlink, so it stays current after `git pull`. It breaks if you move or delete the checkout. To re-link from the new place, remove the old link first: `rm ~/.claude/skills/agentscrum && ln -s "$PWD/skills/agentscrum" ~/.claude/skills/agentscrum`. To remove it: `rm ~/.claude/skills/agentscrum`.

The CLI, the MCP server, `npm run db:migrate`, and the dashboard must use the same database. The simplest setup is the default above. If you want another path, set `SCRUM_DB_PATH` in your shell profile and pass the same absolute path to `claude mcp add`. Avoid setting it only in `<checkout>/.env`: the `scrum` CLI reads that file, but `db:migrate`, the dashboard, and the MCP server do not. `npm run doctor` prints the path from your shell and warns when `.env` gives the CLI a different one; compare it with the `SCRUM_DB_PATH` in your MCP registration (`claude mcp get agentscrum`).

Use absolute paths for the Node binary, `SCRUM_DB_PATH`, and `server.js`. A bare `node` resolves from whatever PATH the client has, which can be a different Node version than the one that built `better-sqlite3`. `--scope user` makes the tools available in every project; the default `local` scope applies to one directory only.

Once registered, all 27 MCP tools are available in every Claude Code session. See [mcp-tools.md](mcp-tools.md).

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

Then register the MCP server as in step 6 and add the CLAUDE.md snippet that `init` prints to each project, if you use it.

## Dashboard

A read-only SvelteKit web dashboard that reads directly from the AgentScrum SQLite DB. In the container it runs at http://127.0.0.1:5180; natively, start it yourself.

**Views:** Overview · Live · Sprint Board · All Sprints · Epics · Issues · Velocity · Token Usage · Decisions · Lessons

```bash
# Run the dashboard dev server (port 5173)
npm run dev:dashboard

# Or from dashboard/ directly
cd dashboard && npm run dev
```

The dashboard reads the same database as the CLI and MCP server, using the rules in [Database location](maintenance.md#database-location). It never creates or migrates a database. If the file is missing or not migrated, every page returns 503 with a message that says how to fix it, and `/healthz` returns 503 with the reason. Install the root package (`npm ci` in the repo root) before the dashboard; the dashboard uses the root's `drizzle-orm`.

**URL params:**

| Param | Values | Description |
|-------|--------|-------------|
| `?project=<id>` | integer | Select project (default: first project in DB) |
| `?nav=topbar` | topbar (default) | Show full top nav (standalone mode) |
| `?nav=none` | none | Hide nav entirely (embed mode for Orion main dashboard) |
| `?view=<name>` | overview, live, sprint, sprints, epics, issues, velocity, tokens, decisions, lessons | Active view |

## What installing AgentScrum changes on your machine

A first install changes these things. Each has the command that undoes it.

| Change | Where | Undo |
|---|---|---|
| MCP registration | Claude Code's user settings: `claude mcp add agentscrum --scope user ...` (container or native) | `claude mcp remove agentscrum --scope user` |
| Skill symlink | `~/.claude/skills/agentscrum`, pointing at `<checkout>/skills/agentscrum`. The install also creates `~/.claude/skills/` if it was missing. | `rm ~/.claude/skills/agentscrum` (removes only the link, not the checkout) |
| Database, container install | Docker volumes `agentscrum-data` and `agentscrum-restore` (the second only after you run `restore`) | `docker compose --profile tools down -v` from the checkout. Without `--profile tools`, `down -v` leaves `agentscrum-restore`. This deletes your data; take a backup first. |
| Database, native install | `<checkout>/agentscrum.db` with its `-wal` and `-shm` files, or the file `SCRUM_DB_PATH` names | Move or delete the three files. This deletes your data; move them aside as in [Starting fresh](#starting-fresh) if you may need them. |
| Container image | Docker image `agentscrum:local` | `docker image rm agentscrum:local` |
| Default Node, native install | `nvm alias default 24` changes nvm's default Node for new shells | `nvm alias default <your previous version>` |
| Global `scrum` command, native install | `npm link` adds a `scrum` link to npm's global folder | `npm unlink -g agentscrum` |
| The `scrum init` block | Printed for you to paste into a project's `CLAUDE.md`. AgentScrum never writes to `CLAUDE.md`. | Delete the block from that `CLAUDE.md` if you pasted it. |

`scrum init` also records the project's folder in the database. It does not write anything into that folder.
