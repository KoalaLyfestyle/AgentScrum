import { json, error } from '@sveltejs/kit';
import { getVelocity } from '$scrum/services/scrum.js';
import { z } from 'zod';
import type { RequestHandler } from './$types';

const VelocityItemSchema = z.object({
	sprintNumber: z.number(),
	sprintTitle: z.string().optional(),
	pointsCompleted: z.number(),
	issuesCompleted: z.number(),
	tokensUsed: z.number(),
	tokensByAgent: z.record(z.string(), z.number()).optional()
});

export const GET: RequestHandler = ({ url }) => {
	const projectId = Number(url.searchParams.get('project') ?? '1');
	if (!Number.isInteger(projectId) || projectId < 1) error(400, 'Invalid project id');
	const data = getVelocity(projectId);
	return json(z.array(VelocityItemSchema).parse(data));
};
