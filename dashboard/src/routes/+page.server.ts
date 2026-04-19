import type { PageServerLoad } from './$types';
import { listProjects } from '$scrum/services/scrum.js';

export const load: PageServerLoad = async ({ url, fetch }) => {
	const projectId = Number(url.searchParams.get('project') ?? '1');

	const projects = listProjects().map((p) => ({ id: p.id, name: p.name }));

	const [sprintRes, velocityRes, costsRes, retroRes] = await Promise.all([
		fetch(`/api/sprint?project=${projectId}`),
		fetch(`/api/velocity?project=${projectId}`),
		fetch(`/api/costs?project=${projectId}`),
		fetch(`/api/retro?project=${projectId}`)
	]);

	const [sprint, velocity, costs, retro] = await Promise.all([
		sprintRes.ok ? sprintRes.json() : null,
		velocityRes.ok ? velocityRes.json() : [],
		costsRes.ok ? costsRes.json() : null,
		retroRes.ok ? retroRes.json() : null
	]);

	return { projects, projectId, sprint, velocity, costs, retro };
};
