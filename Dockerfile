# syntax=docker/dockerfile:1
# AgentScrum: one image, several roles (migrate, dashboard, mcp, cli, backup,
# restore, import). See docker/entrypoint.sh and compose.yaml.
#
# Base: Node 24.21.0 (matches .nvmrc) on Debian bookworm (glibc), pinned by the
# multi-arch index digest, so linux/arm64 and linux/amd64 get the same release.
ARG NODE_IMAGE=node:24.21.0-bookworm-slim@sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20

# ---- build: install all dependencies, compile, then drop dev dependencies ----
FROM ${NODE_IMAGE} AS build
# Compilers are a fallback only: better-sqlite3 normally downloads a prebuilt
# binary. They stay in this stage and never reach the runtime image.
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY dashboard/package.json dashboard/package-lock.json dashboard/.npmrc dashboard/
RUN cd dashboard && npm ci --no-audit --no-fund

COPY tsconfig.json drizzle.config.ts .nvmrc ./
COPY src src
COPY drizzle drizzle
COPY scripts scripts
COPY dashboard dashboard
# The dashboard bakes the checkout root at build time (vite.config.ts); building
# in /app makes it /app, where drizzle/ also lives in the runtime image.
RUN npm run build \
 && cd dashboard && npm run build \
 && cd /app && npm prune --omit=dev --no-audit --no-fund \
 && cd dashboard && npm prune --omit=dev --no-audit --no-fund

# ---- runtime: no compilers, no dev dependencies, non-root ----
FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production \
    SCRUM_DB_PATH=/data/agentscrum.db \
    SCRUM_MIGRATE_ON_OPEN=0 \
    COST_SOURCE=manual \
    HOST=0.0.0.0 \
    PORT=5180
WORKDIR /app
COPY --from=build /app/package.json /app/.nvmrc ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/dashboard/package.json ./dashboard/package.json
COPY --from=build /app/dashboard/node_modules ./dashboard/node_modules
COPY --from=build /app/dashboard/build ./dashboard/build
COPY docker/entrypoint.sh /usr/local/bin/agentscrum
# /data is the named volume. Docker copies this directory's owner into a new
# empty named volume, so the node user can write the database there.
RUN chmod 755 /usr/local/bin/agentscrum \
 && mkdir -p /data /backups /restore \
 && chown node:node /data /backups /restore
USER node
VOLUME ["/data"]
EXPOSE 5180
ENTRYPOINT ["agentscrum"]
CMD ["dashboard"]
