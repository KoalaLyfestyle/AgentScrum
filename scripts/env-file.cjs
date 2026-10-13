'use strict';
// Reads <checkout>/.env the way the scrum CLI applies it: KEY=value lines,
// '#' comments, optional quotes. Shared by bin/scrum.cjs and scripts/doctor.cjs.
const fs = require('fs');

function readEnvFile(file) {
  const values = {};
  if (!fs.existsSync(file)) return values;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (key) values[key] = val;
  }
  return values;
}

/** The environment the scrum CLI runs with: .env values, then the shell's on top. */
function cliEnv(file, env = process.env) {
  return { ...readEnvFile(file), ...env };
}

module.exports = { readEnvFile, cliEnv };
