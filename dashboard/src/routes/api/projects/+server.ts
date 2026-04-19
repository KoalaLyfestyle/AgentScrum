import { json } from '@sveltejs/kit';
import { listProjects } from '$scrum/services/scrum.js';
import { z } from 'zod';

const ProjectSchema = z.object({ id: z.number(), name: z.string() });
const ResponseSchema = z.array(ProjectSchema);

export function GET() {
	const projects = listProjects();
	return json(ResponseSchema.parse(projects.map((p) => ({ id: p.id, name: p.name }))));
}
