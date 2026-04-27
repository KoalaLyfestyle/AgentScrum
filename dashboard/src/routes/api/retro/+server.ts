import { json, error } from '@sveltejs/kit';
import { getRetrospective } from '$scrum/services/scrum.js';
import { z } from 'zod';
import type { RequestHandler } from './$types';

const RetroIssueSchema = z.object({
	id: z.number(),
	title: z.string(),
	status: z.string(),
	cycleTimeHours: z.number().optional()
});

const RetroSchema = z.object({
	sprintNumber: z.number(),
	sprintTitle: z.string().optional(),
	blockedIssues: z.array(RetroIssueSchema),
	incompleteAcIssues: z.array(RetroIssueSchema),
	expensiveIssues: z.array(RetroIssueSchema),
	cycleTimeSummary: z
		.object({
			avgHours: z.number(),
			minHours: z.number(),
			maxHours: z.number(),
			issueCount: z.number()
		})
		.optional()
});

export const GET: RequestHandler = ({ url }) => {
	const projectId = Number(url.searchParams.get('project') ?? '1');
	if (!Number.isInteger(projectId) || projectId < 1) error(400, 'Invalid project id');
	try {
		const retro = getRetrospective(projectId);
		return json(RetroSchema.parse(retro));
	} catch (e) {
		error(404, e instanceof Error ? e.message : 'Not found');
	}
};
