#!/usr/bin/env node
'use strict';
// CommonJS so __dirname resolves the real file path, even through npm link symlinks.
const { spawnSync } = require('child_process');
const { resolve } = require('path');
const { homedir } = require('os');
const fs = require('fs');

const projectRoot = resolve(__dirname, '..');
const tsx = resolve(projectRoot, 'node_modules', '.bin', 'tsx');
const cli = resolve(projectRoot, 'src', 'cli', 'index.ts');

// Load env files in priority order (later files win):
//   1. ~/.env        — root varlock values (portable, survives project moves)
//   2. <project>/.env — project-level overrides
function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (key && !(key in process.env)) process.env[key] = val;
  }
}

loadEnv(resolve(homedir(), '.env'));            // root — varlock source of truth
loadEnv(resolve(projectRoot, '.env'));          // project — overrides only if needed

const result = spawnSync(tsx, [cli, ...process.argv.slice(2)], { stdio: 'inherit' });
process.exit(result.status ?? 0);
