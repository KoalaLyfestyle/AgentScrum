import type { PageServerLoad } from './$types';
import {
	listProjects,
	listSprints,
	listEpics,
	getIssuesByProject,
	getVelocity,
	getDecisions,
	getLessons
} from '$scrum/services/scrum.js';
import { getDb, schema } from '$scrum/db/index.js';
import { inArray } from 'drizzle-orm';

export const load: PageServerLoad = async ({ url }) => {
	const projectId = Number(url.searchParams.get('project') ?? '1');

	const projects = listProjects().map((p) => ({ id: p.id, name: p.name }));
	const sprints = listSprints(projectId);
	const epics = listEpics(projectId);
	const issues = getIssuesByProject(projectId);
	const velocity = getVelocity(projectId);
	const decisions = getDecisions(projectId);
	const lessons = getLessons(projectId);

	// Bulk-load sessions and ACs for all project issues
	const issueIds = issues.map((i) => i.id);
	const db = getDb();

	let sessions: any[] = [];
	let acs: any[] = [];

	if (issueIds.length > 0) {
		sessions = db
			.select()
			.from(schema.sessions)
			.where(inArray(schema.sessions.issueId, issueIds))
			.all();

		acs = db
			.select()
			.from(schema.acceptanceCriteria)
			.where(inArray(schema.acceptanceCriteria.issueId, issueIds))
			.all();
	}

	// Compute model distribution from sessions
	const modelMap: Record<string, { tokensUsed: number; sessions: number }> = {};
	for (const s of sessions) {
		const model = (s as any).model ?? 'unknown';
		if (!modelMap[model]) modelMap[model] = { tokensUsed: 0, sessions: 0 };
		modelMap[model].tokensUsed += (s as any).tokensUsed;
		modelMap[model].sessions += 1;
	}
	const modelDistribution = Object.entries(modelMap)
		.map(([model, stats]) => ({ model, ...stats }))
		.sort((a, b) => b.tokensUsed - a.tokensUsed);

	return {
		projects,
		projectId,
		sprints,
		epics,
		issues,
		sessions,
		acs,
		velocity,
		decisions,
		lessons,
		modelDistribution
	};
};
