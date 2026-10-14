import { json } from '@sveltejs/kit';
import { checkSchema } from '$scrum/db/index.js';
import type { RequestHandler } from './$types';

// Health check for the container and for humans: 200 when the database opens
// and every migration in drizzle/ is applied, 503 with the reason otherwise.
// Read-only: it never creates or migrates the database.
export const GET: RequestHandler = () => {
	try {
		const status = checkSchema();
		if (status.ok) return json({ ok: true, migrations: status.expected });
		return json(
			{
				ok: false,
				reason: status.reason,
				pending: status.pending,
				fix: 'Run the migrate step: docker compose up -d migrate, or npm run db:migrate in the checkout.'
			},
			{ status: 503 }
		);
	} catch (err) {
		return json(
			{ ok: false, reason: err instanceof Error ? err.message : String(err) },
			{ status: 503 }
		);
	}
};
