// Sync AGENTSCRUM_DB_PATH → SCRUM_DB_PATH so the ScrumService singleton
// picks up the dashboard's DB path on first use.
const resolved = process.env['AGENTSCRUM_DB_PATH'] ?? '../agentscrum.db';
process.env['SCRUM_DB_PATH'] = resolved;
