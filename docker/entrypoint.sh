#!/bin/sh
# AgentScrum container entry point. The first argument picks the role.
# Diagnostics go to stderr: the mcp role's stdout carries only MCP JSON-RPC.
set -eu
app="${AGENTSCRUM_APP:-/app}"  # tests run this script natively against a checkout

role="${1:-dashboard}"
[ "$#" -gt 0 ] && shift

case "$role" in
  migrate)
    exec node "$app/dist/db/migrate.js" "$@" ;;
  dashboard)
    exec node "$app/dashboard/build" "$@" ;;
  mcp)
    exec node "$app/dist/mcp/server.js" "$@" ;;
  cli)
    exec node "$app/dist/cli/index.js" "$@" ;;
  backup|restore|import|counts)
    exec node "$app/scripts/db-tools.mjs" "$role" "$@" ;;
  doctor)
    exec node "$app/scripts/doctor.cjs" "$@" ;;
  *)
    echo "agentscrum: unknown role '$role'" >&2
    echo "roles: migrate, dashboard, mcp, cli, backup, restore, import, counts, doctor" >&2
    exit 64 ;;
esac
