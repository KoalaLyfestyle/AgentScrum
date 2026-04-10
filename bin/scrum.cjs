#!/usr/bin/env node
'use strict';
// CommonJS so __dirname resolves the real file path, even through npm link symlinks.
const { spawnSync } = require('child_process');
const { resolve } = require('path');

const projectRoot = resolve(__dirname, '..');
const tsx = resolve(projectRoot, 'node_modules', '.bin', 'tsx');
const cli = resolve(projectRoot, 'src', 'cli', 'index.ts');

const result = spawnSync(tsx, [cli, ...process.argv.slice(2)], { stdio: 'inherit' });
process.exit(result.status ?? 0);
