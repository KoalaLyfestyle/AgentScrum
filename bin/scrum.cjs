#!/usr/bin/env node
'use strict';
// CommonJS so __dirname resolves the real file path, even through npm link symlinks.
const { spawnSync } = require('child_process');
const { resolve } = require('path');
const fs = require('fs');

const projectRoot = resolve(__dirname, '..');
const tsx = resolve(projectRoot, 'node_modules', '.bin', 'tsx');
const cli = resolve(projectRoot, 'src', 'cli', 'index.ts');

// Load .env from project root (simple parser — no dotenv dependency)
const envFile = resolve(projectRoot, '.env');
if (fs.existsSync(envFile)) {
  const lines = fs.readFileSync(envFile, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (key && !(key in process.env)) process.env[key] = val;
  }
}

const result = spawnSync(tsx, [cli, ...process.argv.slice(2)], { stdio: 'inherit' });
process.exit(result.status ?? 0);
