<script lang="ts">
	import Badge from './Badge.svelte';
	import IssueKey from './IssueKey.svelte';
	import { fmt } from '$lib/utils/fmt.js';

	let {
		data,
		onIssueSelect
	}: {
		data: any;
		onIssueSelect: (i: any) => void;
	} = $props();

	let search = $state('');
	let filter = $state('All');
	let sort = $state('epic');

	let projectEpicIds = $derived(
		new Set(data.epics.filter((e: any) => e.projectId === data.projectId).map((e: any) => e.id))
	);
	let allIssues = $derived(data.issues.filter((i: any) => projectEpicIds.has(i.epicId)));
	let backlog = $derived(allIssues.filter((i: any) => !i.sprintId));

	const statusMap: Record<string, string> = {
		'Todo': 'todo', 'In Progress': 'in_progress', 'Review': 'review', 'Done': 'done', 'Blocked': 'blocked'
	};
	const statusOrder: Record<string, number> = { in_progress: 0, blocked: 1, review: 2, todo: 3, done: 4 };

	function filterFn(i: any): boolean {
		if (filter !== 'All' && i.status !== statusMap[filter]) return false;
		if (search && !i.title.toLowerCase().includes(search.toLowerCase())) return false;
		return true;
	}

	function sortFn(arr: any[]): any[] {
		return [...arr].sort((a, b) => {
			if (sort === 'epic') {
				const ea = data.epics.find((e: any) => e.id === a.epicId);
				const eb = data.epics.find((e: any) => e.id === b.epicId);
				return ((ea?.number ?? 0) - (eb?.number ?? 0)) || (a.number - b.number);
			}
			if (sort === 'status') return (statusOrder[a.status] ?? 5) - (statusOrder[b.status] ?? 5);
			if (sort === 'points') return (b.storyPoints ?? 0) - (a.storyPoints ?? 0);
			if (sort === 'tokens') return b.tokensUsed - a.tokensUsed;
			return 0;
		});
	}

	let filteredAll = $derived(sortFn(allIssues.filter(filterFn)));
	let filteredBacklog = $derived(backlog.filter(filterFn));

	function epicForIssue(issue: any) {
		return data.epics.find((e: any) => e.id === issue.epicId);
	}
</script>

<div>
	<div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:var(--space-5);">
		<div>
			<h2 style="font-size:var(--text-xl);margin-bottom:2px;">Issues</h2>
			<p style="font-size:var(--text-sm);color:var(--text-muted);margin:0;">{allIssues.length} total · {backlog.length} in backlog</p>
		</div>
	</div>

	<!-- Search/Filter bar -->
	<div style="display:flex;gap:var(--space-3);margin-bottom:var(--space-4);flex-wrap:wrap;align-items:center;">
		<div style="position:relative;flex:1;min-width:180px;">
			<div style="position:absolute;left:10px;top:50%;transform:translateY(-50%);pointer-events:none;">
				<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
			</div>
			<input class="ds-input" placeholder="Search…" bind:value={search} style="padding-left:32px;"/>
		</div>
		<div style="display:flex;gap:var(--space-1);">
			{#each ['All', 'Todo', 'In Progress', 'Review', 'Done', 'Blocked'] as f}
				<button class="btn btn-ghost {filter === f ? 'active-btn' : ''}" style="padding:6px 12px;font-size:var(--text-xs);" onclick={() => (filter = f)}>{f}</button>
			{/each}
		</div>
		<div style="display:flex;gap:var(--space-1);">
			{#each [['epic', 'Epic'], ['status', 'Status'], ['points', 'Points'], ['tokens', 'Tokens']] as [k, l]}
				<button class="btn btn-ghost {sort === k ? 'active-btn' : ''}" style="padding:6px 12px;font-size:var(--text-xs);" onclick={() => (sort = k)}>{l}</button>
			{/each}
		</div>
	</div>

	<!-- Backlog section -->
	<div style="margin-bottom:var(--space-6);">
		<div style="display:flex;align-items:center;gap:var(--space-3);margin-bottom:var(--space-3);">
			<div style="font-family:var(--font-display);font-size:var(--text-sm);font-weight:600;color:var(--text-muted);letter-spacing:0.04em;">Backlog</div>
			<div style="flex:1;height:1px;background:var(--border-subtle);"></div>
			<span style="font-family:var(--font-mono);font-size:var(--text-xs);color:var(--text-muted);">{filteredBacklog.length} issues</span>
		</div>
		{#if filteredBacklog.length === 0}
			<div class="glass-standard" style="text-align:center;padding:var(--space-6);color:var(--text-muted);font-size:var(--text-sm);">No backlog issues match your search.</div>
		{:else}
			<div class="glass-standard" style="padding:0;overflow-x:auto;">
				<table class="data-table">
					<thead><tr><th>Key</th><th>Title</th><th>Type</th><th>Pri</th><th>Status</th><th>Pts</th><th>Tokens</th></tr></thead>
					<tbody>
						{#each filteredBacklog as issue}
							{@const epic = epicForIssue(issue)}
							<tr onclick={() => onIssueSelect(issue)} style="cursor:pointer;">
								<td>{#if epic}<IssueKey epicNum={epic.number} issueNum={issue.number}/>{/if}</td>
								<td style="font-family:var(--font-body);color:var(--text-primary);max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{issue.title}</td>
								<td><Badge type={issue.type}/></td>
								<td><Badge priority={issue.priority}/></td>
								<td><Badge status={issue.status}/></td>
								<td>{issue.storyPoints ?? '—'}</td>
								<td>{fmt.tokens(issue.tokensUsed)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>

	<!-- All issues section -->
	<div>
		<div style="display:flex;align-items:center;gap:var(--space-3);margin-bottom:var(--space-3);">
			<div style="font-family:var(--font-display);font-size:var(--text-sm);font-weight:600;color:var(--text-muted);letter-spacing:0.04em;">All Issues</div>
			<div style="flex:1;height:1px;background:var(--border-subtle);"></div>
			<span style="font-family:var(--font-mono);font-size:var(--text-xs);color:var(--text-muted);">{filteredAll.length} issues</span>
		</div>
		{#if filteredAll.length === 0}
			<div class="glass-standard" style="text-align:center;padding:var(--space-6);color:var(--text-muted);font-size:var(--text-sm);">No issues match your filters.</div>
		{:else}
			<div class="glass-standard" style="padding:0;overflow-x:auto;">
				<table class="data-table">
					<thead><tr><th>Key</th><th>Title</th><th>Type</th><th>Pri</th><th>Status</th><th>Pts</th><th>Tokens</th><th>Sprint</th></tr></thead>
					<tbody>
						{#each filteredAll as issue}
							{@const epic = epicForIssue(issue)}
							{@const sprint = data.sprints.find((s: any) => s.id === issue.sprintId)}
							<tr onclick={() => onIssueSelect(issue)} style="cursor:pointer;">
								<td>{#if epic}<IssueKey epicNum={epic.number} issueNum={issue.number}/>{/if}</td>
								<td style="font-family:var(--font-body);color:var(--text-primary);max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{issue.title}</td>
								<td><Badge type={issue.type}/></td>
								<td><Badge priority={issue.priority}/></td>
								<td><Badge status={issue.status}/></td>
								<td>{issue.storyPoints ?? '—'}</td>
								<td>{fmt.tokens(issue.tokensUsed)}</td>
								<td style="font-size:10px;color:var(--text-muted);">{sprint ? `S${sprint.number}` : 'Backlog'}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>
</div>
