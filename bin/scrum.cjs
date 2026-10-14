#!/usr/bin/env node
'use strict';
// CommonJS so __dirname resolves the real file path, even through npm link symlinks.
const { spawnSync } = require('child_process');
const { resolve } = require('path');

const projectRoot = resolve(__dirname, '..');
const tsx = resolve(projectRoot, 'node_modules', '.bin', 'tsx');
const cli = resolve(projectRoot, 'src', 'cli', 'index.ts');

// Load project .env if present (non-varlock users — create this file with your values).
// Varlock users: run `varlock run -- scrum <project> <command>` instead.
const envFile = resolve(projectRoot, '.env');
const { readEnvFile } = require(resolve(projectRoot, 'scripts', 'env-file.cjs'));
for (const [key, val] of Object.entries(readEnvFile(envFile))) {
  if (!(key in process.env)) process.env[key] = val;
}

const result = spawnSync(tsx, [cli, ...process.argv.slice(2)], { stdio: 'inherit' });
process.exit(result.status ?? 0);
