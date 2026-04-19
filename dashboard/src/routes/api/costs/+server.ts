import { json, error } from '@sveltejs/kit';
import { getCostReport } from '$scrum/services/scrum.js';
import { z } from 'zod';
import type { RequestHandler } from './$types';

const CostIssueSchema = z.object({
	issueId: z.number(),
	issueKey: z.string(),
	title: z.string(),
	assignedTo: z.string().optional(),
	tokensUsed: z.number()
});

const CostReportSchema = z.object({
	sprintNumber: z.number(),
	sprintTitle: z.string().optional(),
	issues: z.array(CostIssueSchema),
	totalTokens: z.number()
});

export const GET: RequestHandler = ({ url }) => {
	const projectId = Number(url.searchParams.get('project') ?? '1');
	if (!Number.isInteger(projectId) || projectId < 1) error(400, 'Invalid project id');
	try {
		const report = getCostReport(projectId);
		return json(CostReportSchema.parse(report));
	} catch (e) {
		error(404, e instanceof Error ? e.message : 'Not found');
	}
};
