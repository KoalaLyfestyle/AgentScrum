# Container

The container is the supported install path. The image fixes the Node version and the native `better-sqlite3` build, so your own Node setup does not matter. You need Docker (Docker Desktop on macOS).

## Install

```bash
git clone https://github.com/KoalaLyfestyle/AgentScrum.git
cd AgentScrum
docker compose up -d --build        # builds the image, runs migrate once, starts the dashboard
curl http://127.0.0.1:5180/healthz  # {"ok":true,"migrations":15}
```

Register the MCP server with Claude Code, from the checkout. Each session starts its own short-lived container on the shared database:

```bash
claude mcp add agentscrum --scope user -- "$PWD/bin/agentscrum-mcp"
```

Install the agent workflow skill at user scope, as a symlink, from the checkout. It stays current after `git pull`:

```bash
mkdir -p ~/.claude/skills
ln -s "$PWD/skills/agentscrum" ~/.claude/skills/agentscrum
```

The link breaks if you move or delete the checkout; run the `ln -s` line again from the new place. To remove the skill: `rm ~/.claude/skills/agentscrum`.

Use the CLI through Compose, from the checkout. Always name the project: the container cannot see your working directory, so it cannot detect the project from it.

```bash
docker compose run --rm cli init myproject          # once per project
docker compose run --rm cli myproject status
```

The dashboard is at http://127.0.0.1:5180. Data lives in the Docker volume `agentscrum-data` and survives `docker compose restart`, `down`, and rebuilds. `docker compose down -v` deletes it.

A host `scrum` (native install) does not read this volume. It reads `<checkout>/agentscrum.db`. If the MCP server runs in the container, use `docker compose run --rm cli` for the CLI too.

Tested platforms: the native install on macOS arm64 and Linux x86_64, and the container on macOS arm64 with OrbStack ([Mac check of PR #22](https://github.com/KoalaLyfestyle/AgentScrum/pull/22#issuecomment-6163004767)).

## Roles

One image, several roles. `docker/entrypoint.sh` picks the role from the first argument; `compose.yaml` wires them up.

| Role | How it runs | What it does |
|---|---|---|
| `migrate` | `docker compose up` runs it once, first | The only process that changes the schema |
| `dashboard` | Compose service, `127.0.0.1:5180` | Read-only dashboard; `GET /healthz` returns 200 when every migration is applied, 503 with the reason otherwise |
| `mcp` | `bin/agentscrum-mcp`, one container per Claude Code session | MCP over stdio. Does not migrate, and refuses a missing or out-of-date database |
| `cli` | `docker compose run --rm cli <project> <command>` | The `scrum` CLI |
| `backup` | `docker compose run --rm backup` | WAL-safe snapshot into `./backups/` |
| `restore` | `docker compose run --rm restore /backups/<file>.db` | Restores into the separate volume `agentscrum-restore` and checks row counts |
| `import` | see below | Copies an existing database into an empty `agentscrum-data` volume |

Port 5180 is bound to `127.0.0.1` only. It does not clash with Langfuse (3000).

## Move from a native install

Import your database into a fresh volume before the first `up`:

```bash
mkdir -p backups import
docker compose build
AGENTSCRUM_IMPORT_DIR=/absolute/path/to/folder/with/the/db \
  docker compose run --rm import /import/agentscrum.db   # refuses if the volume already has a database
docker compose up -d                                       # migrate brings the schema up to date
```

The folder is mounted read-only and the source is opened read-only, so the import never changes it. It uses SQLite's online backup API, which includes writes still in the WAL, and checks that every table's row count matches. Close Claude Code sessions that use the database first, so it is not changing during the copy.

## Back up

Create the folder first, so Docker does not create it as root:

```bash
mkdir -p backups
docker compose run --rm backup          # writes ./backups/agentscrum-<UTC time>.db
```

On Linux the container runs as uid 1000. If your user has another uid, run `sudo chown 1000 backups` once. Backups are standalone files (no `-wal`), safe to copy anywhere.

## Restore a backup

`restore` writes to the separate volume `agentscrum-restore` and checks that every table's row count matches the backup. It never writes to `agentscrum-data`:

```bash
docker compose run --rm restore /backups/<file>.db
docker run --rm -v agentscrum-restore:/data agentscrum:local counts /data/agentscrum.db
```

To switch to the restored copy, stop everything, keep the old database beside it, and copy the restored one in:

```bash
docker compose down        # also close Claude Code sessions that use AgentScrum
docker run --rm -v agentscrum-restore:/from -v agentscrum-data:/data --entrypoint sh agentscrum:local -c \
  'mkdir -p /data/before-restore && mv /data/agentscrum.db* /data/before-restore/ && cp /from/agentscrum.db /data/agentscrum.db'
docker compose up -d
```

## Limits

- `COST_SOURCE=transcript` does not work in the container: it reads Claude Code transcripts under your home folder, which the container cannot see. The container uses `manual`.
- CLI project detection from the working directory does not work in the container; pass the project name.
- MCP runs over stdio only. Each session starts a container, which adds about a second to session start.

## What has been checked

The roles were run natively through `docker/entrypoint.sh` on Linux x86_64 with Node 24.21.0: migrate, two MCP servers with a claim race (one winner), backup, restore, import, and the production dashboard build with `/healthz`. `npm test` covers this (`tests/integration/container-roles.test.ts`). The image build, `docker compose up`, an MCP round trip from Claude Code, restart, and backup and restore were checked on macOS arm64 with OrbStack in the [Mac check of PR #22](https://github.com/KoalaLyfestyle/AgentScrum/pull/22#issuecomment-6163004767). To run the MCP check against the real container, see `scripts/mcp-smoke.mjs`.
