<script lang="ts">
	import Badge from './Badge.svelte';
	import IssueKey from './IssueKey.svelte';
	import StatCard from './StatCard.svelte';
	import { fmt } from '$lib/utils/fmt.js';

	let {
		data,
		epicId,
		onNavigate,
		onIssueSelect
	}: {
		data: any;
		epicId: number;
		onNavigate: (p: { view: string; sprint?: number; epic?: number }) => void;
		onIssueSelect: (i: any) => void;
	} = $props();

	let epic = $derived(data.epics.find((e: any) => e.id === epicId));
	let issues = $derived(
		data.issues
			.filter((i: any) => i.epicId === epicId)
			.sort((a: any, b: any) => {
				const order: Record<string, number> = { in_progress: 0, blocked: 1, review: 2, todo: 3, done: 4 };
				return (order[a.status] ?? 5) - (order[b.status] ?? 5);
			})
	);
	let done = $derived(issues.filter((i: any) => i.status === 'done').length);
	let totalPts = $derived(issues.reduce((s: number, i: any) => s + (i.storyPoints ?? 0), 0));
	let donePts = $derived(issues.filter((i: any) => i.status === 'done').reduce((s: number, i: any) => s + (i.storyPoints ?? 0), 0));

	// Group by sprint
	type SprintGroup = { sprint: any; issues: any[] };
	let sprintGroups = $derived(() => {
		const groups: Record<string, any[]> = {};
		issues.forEach((i: any) => {
			const key = i.sprintId ? String(i.sprintId) : 'backlog';
			if (!groups[key]) groups[key] = [];
			groups[key].push(i);
		});
		// Sort: active first, then by number desc, backlog last
		return Object.entries(groups).map(([sid, iss]) => {
			const sprint = sid === 'backlog' ? null : data.sprints.find((s: any) => s.id === Number(sid));
			return { sprint, issues: iss };
		}).sort((a, b) => {
			if (!a.sprint) return 1;
			if (!b.sprint) return -1;
			return b.sprint.number - a.sprint.number;
		});
	});

	let sprintCount = $derived(() => {
		const groups = sprintGroups();
		return groups.filter((g: SprintGroup) => g.sprint !== null).length;
	});
	let totalTokens = $derived(issues.reduce((s: number, i: any) => s + i.tokensUsed, 0));
</script>

<div>
	<button class="btn btn-ghost" style="font-size:var(--text-xs);padding:4px 10px;margin-bottom:var(--space-3);" onclick={() => onNavigate({ view: 'epics' })}>← All Epics</button>

	<div style="display:flex;align-items:center;gap:var(--space-3);margin-bottom:4px;">
		<span style="font-family:var(--font-mono);color:var(--accent-ember);font-size:var(--text-md);">E{String(epic?.number).padStart(2, '0')}</span>
		<h2 style="margin:0;">{epic?.title}</h2>
		<Badge status={epic?.status}/>
	</div>

	<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:var(--space-3);margin:var(--space-4) 0 var(--space-6);">
		<StatCard label="Issues" value={issues.length} sub="{done} done"/>
		<StatCard label="Story Points" value="{donePts}/{totalPts}" sub="completed"/>
		<StatCard label="Sprints" value={sprintCount()} sub="touched"/>
		<StatCard label="Tokens" value={fmt.tokens(totalTokens)} sub="total"/>
	</div>

	{#each sprintGroups() as { sprint, issues: iss }}
		<div style="margin-bottom:var(--space-6);">
			<div style="display:flex;align-items:center;gap:var(--space-3);margin-bottom:var(--space-3);cursor:{sprint ? 'pointer' : 'default'};"
				onclick={() => sprint && onNavigate({ view: 'sprint', sprint: sprint.id })}>
				<div style="font-family:var(--font-display);font-size:var(--text-sm);font-weight:600;color:var(--text-muted);letter-spacing:0.04em;">{sprint ? sprint.title : 'Backlog'}</div>
				{#if sprint}<Badge status={sprint.status}/>{/if}
				<div style="flex:1;height:1px;background:var(--border-subtle);"></div>
				<span style="font-family:var(--font-mono);font-size:var(--text-xs);color:var(--text-muted);">{iss.length} issues</span>
			</div>
			<div class="glass-standard" style="padding:0;overflow-x:auto;">
				<table class="data-table">
					<thead>
						<tr>
							<th>#</th><th>Title</th><th>Type</th><th>Status</th><th>Pts</th><th>Tokens</th>
						</tr>
					</thead>
					<tbody>
						{#each iss as issue}
							<tr onclick={() => onIssueSelect(issue)} style="cursor:pointer;">
								<td><IssueKey epicNum={epic?.number ?? '?'} issueNum={issue.number}/></td>
								<td style="font-family:var(--font-body);color:var(--text-primary);max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{issue.title}</td>
								<td><Badge type={issue.type}/></td>
								<td><Badge status={issue.status}/></td>
								<td>{issue.storyPoints ?? '—'}</td>
								<td>{fmt.tokens(issue.tokensUsed)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/each}
</div>
