<script lang="ts">
	import Badge from './Badge.svelte';
	import UsageBar from './UsageBar.svelte';
	import { fmt } from '$lib/utils/fmt.js';

	let {
		data,
		onNavigate
	}: {
		data: any;
		onNavigate: (p: { view: string; sprint?: number; epic?: number }) => void;
	} = $props();

	let search = $state('');
	let filter = $state('All');
	let sort = $state('newest');

	let allSprints = $derived(data.sprints.filter((s: any) => s.projectId === data.projectId));

	let filtered = $derived(
		allSprints
			.filter((s: any) => {
				if (filter !== 'All' && s.status.toLowerCase() !== filter.toLowerCase()) return false;
				if (search && !s.title?.toLowerCase().includes(search.toLowerCase()) && !s.goal?.toLowerCase().includes(search.toLowerCase())) return false;
				return true;
			})
			.sort((a: any, b: any) =>
				sort === 'newest' ? b.number - a.number
				: sort === 'oldest' ? a.number - b.number
				: issuesForSprint(b.id).length - issuesForSprint(a.id).length
			)
	);

	function issuesForSprint(sid: number) {
		return data.issues.filter((i: any) => i.sprintId === sid);
	}
</script>

<div>
	<div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:var(--space-5);">
		<div>
			<h2 style="font-size:var(--text-xl);margin-bottom:2px;">All Sprints</h2>
			<p style="font-size:var(--text-sm);color:var(--text-muted);margin:0;">{allSprints.length} total</p>
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
			{#each ['All', 'Active', 'Closed', 'Planning'] as f}
				<button class="btn btn-ghost {filter === f ? 'active-btn' : ''}" style="padding:6px 12px;font-size:var(--text-xs);" onclick={() => (filter = f)}>{f}</button>
			{/each}
		</div>
		<div style="display:flex;gap:var(--space-1);">
			{#each [['newest', 'Newest'], ['oldest', 'Oldest'], ['issues', 'Most Issues']] as [k, l]}
				<button class="btn btn-ghost {sort === k ? 'active-btn' : ''}" style="padding:6px 12px;font-size:var(--text-xs);" onclick={() => (sort = k)}>{l}</button>
			{/each}
		</div>
	</div>

	<div style="display:flex;flex-direction:column;gap:var(--space-4);">
		{#if filtered.length === 0}
			<div class="glass-standard" style="text-align:center;padding:var(--space-12);color:var(--text-muted);font-size:var(--text-sm);">No sprints match your filters.</div>
		{/if}
		{#each filtered as sprint}
			{@const issues = issuesForSprint(sprint.id)}
			{@const done = issues.filter((i: any) => i.status === 'done').length}
			{@const pts = issues.reduce((s: number, i: any) => s + (i.storyPoints ?? 0), 0)}
			{@const ptsDone = issues.filter((i: any) => i.status === 'done').reduce((s: number, i: any) => s + (i.storyPoints ?? 0), 0)}
			<div class="glass-standard" style="cursor:pointer;" onclick={() => onNavigate({ view: 'sprint', sprint: sprint.id })}>
				<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:var(--space-4);">
					<div>
						<div style="display:flex;align-items:center;gap:var(--space-2);margin-bottom:4px;">
							<span style="font-family:var(--font-mono);font-size:var(--text-sm);color:var(--accent-ember);font-weight:500;">S{String(sprint.number).padStart(2, '0')}</span>
							<h3 style="font-size:var(--text-md);margin:0;">{sprint.title ?? `Sprint ${sprint.number}`}</h3>
							<Badge status={sprint.status}/>
						</div>
						<p style="font-family:var(--font-body);font-size:var(--text-sm);color:var(--text-muted);font-style:italic;margin:0 0 var(--space-1);">{sprint.goal ?? '—'}</p>
						<div style="font-family:var(--font-mono);font-size:var(--text-xs);color:var(--text-muted);">{fmt.date(sprint.startedAt)} — {sprint.closedAt ? fmt.date(sprint.closedAt) : 'ongoing'} · {issues.length} issues · {ptsDone}/{pts} pts</div>
					</div>
					<div style="color:var(--text-muted);font-family:var(--font-mono);font-size:var(--text-xs);flex-shrink:0;">→</div>
				</div>
				{#if issues.length > 0}
					<UsageBar value={done} max={issues.length} sub="{done}/{issues.length} done"/>
				{/if}
			</div>
		{/each}
	</div>
</div>
