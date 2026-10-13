import { json, error } from '@sveltejs/kit';
import {
	listSprints,
	listIssues,
	listEpics,
	getSprintSummary,
	issueKey
} from '$scrum/services/scrum.js';
import { z } from 'zod';
import type { RequestHandler } from './$types';

const IssueSchema = z.object({
	id: z.number(),
	key: z.string(),
	title: z.string(),
	type: z.string(),
	status: z.string(),
	priority: z.string(),
	storyPoints: z.number().nullable(),
	assignedTo: z.string().nullable().optional(),
	tokensUsed: z.number(),
	blockerReason: z.string().nullable().optional()
});

const SprintResponseSchema = z.object({
	sprint: z.object({
		id: z.number(),
		number: z.number(),
		title: z.string().nullable().optional(),
		goal: z.string().nullable().optional(),
		status: z.string(),
		startedAt: z.string().nullable().optional(),
		closedAt: z.string().nullable().optional()
	}),
	summary: z.object({
		total: z.number(),
		byStatus: z.record(z.string(), z.number())
	}),
	issues: z.array(IssueSchema),
	isClosed: z.boolean()
});

export const GET: RequestHandler = ({ url }) => {
	const projectId = Number(url.searchParams.get('project') ?? '1');
	if (!Number.isInteger(projectId) || projectId < 1) error(400, 'Invalid project id');

	const sprints = listSprints(projectId);
	const activeSprint = sprints.find((s) => s.status === 'active' || s.status === 'planning');
	const displaySprint = activeSprint ?? sprints.at(-1);

	if (!displaySprint) error(404, 'No sprints found for this project');

	const isClosed = displaySprint.status === 'closed';
	const summary = getSprintSummary(displaySprint.id);
	const issues = listIssues(displaySprint.id);

	// Through the service layer, so all DB access stays in src/db and src/services.
	const epicNumberById = new Map(listEpics(projectId).map((e) => [e.id, e.number]));

	const issuesWithKeys = issues.map((issue) => ({
		id: issue.id,
		key: issueKey(epicNumberById.get(issue.epicId) ?? 0, issue.number),
		title: issue.title,
		type: issue.type,
		status: issue.status,
		priority: issue.priority,
		storyPoints: issue.storyPoints ?? null,
		assignedTo: issue.assignedTo ?? null,
		tokensUsed: issue.tokensUsed,
		blockerReason: issue.blockerReason ?? null
	}));

	return json(
		SprintResponseSchema.parse({
			sprint: displaySprint,
			summary: { total: summary.total, byStatus: summary.byStatus },
			issues: issuesWithKeys,
			isClosed
		})
	);
};
