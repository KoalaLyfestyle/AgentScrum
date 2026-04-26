<script lang="ts">
	import Badge from './Badge.svelte';
	import IssueKey from './IssueKey.svelte';
	import StatCard from './StatCard.svelte';
	import { fmt } from '$lib/utils/fmt.js';

	let {
		data,
		sprintId,
		onNavigate,
		onIssueSelect
	}: {
		data: any;
		sprintId: number;
		onNavigate: (p: { view: string; sprint?: number; epic?: number }) => void;
		onIssueSelect: (i: any) => void;
	} = $props();

	let sprint = $derived(data.sprints.find((s: any) => s.id === sprintId));
	let issues = $derived(
		data.issues
			.filter((i: any) => i.sprintId === sprintId)
			.sort((a: any, b: any) => {
				const order: Record<string, number> = { in_progress: 0, blocked: 1, review: 2, todo: 3, done: 4 };
				return (order[a.status] ?? 5) - (order[b.status] ?? 5);
			})
	);
	let totalPts = $derived(issues.reduce((s: number, i: any) => s + (i.storyPoints ?? 0), 0));
	let donePts = $derived(issues.filter((i: any) => i.status === 'done').reduce((s: number, i: any) => s + (i.storyPoints ?? 0), 0));
	let blocked = $derived(issues.filter((i: any) => i.status === 'blocked'));

	function epicForIssue(issue: any) {
		return data.epics.find((e: any) => e.id === issue.epicId);
	}

	let stats = $derived([
		['To Do',      issues.filter((i: any) => i.status === 'todo').length],
		['In Progress', issues.filter((i: any) => i.status === 'in_progress').length],
		['Review',     issues.filter((i: any) => i.status === 'review').length],
		['Done',       issues.filter((i: any) => i.status === 'done').length],
		['Blocked',    blocked.length],
		['Pts Done',   `${donePts}/${totalPts}`],
	] as [string, string | number][]);
</script>

<div>
	<div style="margin-bottom:var(--space-5);">
		<button class="btn btn-ghost" style="font-size:var(--text-xs);padding:4px 10px;margin-bottom:var(--space-3);" onclick={() => onNavigate({ view: 'sprints' })}>← All Sprints</button>
		<div style="display:flex;align-items:center;gap:var(--space-3);margin-bottom:4px;">
			<h2 style="margin:0;">{sprint?.title}</h2>
			<Badge status={sprint?.status}/>
		</div>
		<p style="font-family:var(--font-body);font-size:var(--text-sm);color:var(--text-muted);font-style:italic;margin:0 0 var(--space-4);">{sprint?.goal}</p>
		<div style="display:grid;grid-template-columns:repeat(6,1fr);gap:var(--space-3);">
			{#each stats as [l, v]}
				<StatCard label={l} value={v}/>
			{/each}
		</div>
	</div>

	{#if blocked.length > 0}
		<div style="background:rgba(251,146,60,0.06);border:1px solid rgba(251,146,60,0.18);border-radius:var(--radius-md);padding:var(--space-3) var(--space-4);margin-bottom:var(--space-4);display:flex;align-items:center;gap:var(--space-3);">
			<span style="color:var(--status-error);font-size:var(--text-xs);font-family:var(--font-display);font-weight:600;text-transform:uppercase;letter-spacing:0.06em;">⚠ {blocked.length} blocked</span>
			<span style="color:var(--text-muted);font-size:var(--text-xs);">{blocked.map((b: any) => b.title).join(' · ')}</span>
		</div>
	{/if}

	<div class="glass-standard" style="padding:0;overflow-x:auto;">
		<table class="data-table">
			<thead>
				<tr>
					<th>Key</th>
					<th>Title</th>
					<th>Type</th>
					<th>Pri</th>
					<th>Pts</th>
					<th>Status</th>
					<th>Agent</th>
					<th>Tokens</th>
				</tr>
			</thead>
			<tbody>
				{#each issues as issue}
					{@const epic = epicForIssue(issue)}
					<tr onclick={() => onIssueSelect(issue)} style="cursor:pointer;">
						<td>{#if epic}<IssueKey epicNum={epic.number} issueNum={issue.number}/>{/if}</td>
						<td style="max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--font-body);color:var(--text-primary);">{issue.title}</td>
						<td><Badge type={issue.type}/></td>
						<td><Badge priority={issue.priority}/></td>
						<td>{issue.storyPoints ?? '—'}</td>
						<td><Badge status={issue.status}/></td>
						<td style="font-size:10px;color:var(--text-muted);">{issue.assignedTo ? issue.assignedTo.replace('claude-', '') : '—'}</td>
						<td>{fmt.tokens(issue.tokensUsed)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>
