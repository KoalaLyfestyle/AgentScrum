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

	let epics = $derived(data.epics.filter((e: any) => e.projectId === data.projectId));

	function issuesForEpic(epicId: number) {
		return data.issues.filter((i: any) => i.epicId === epicId);
	}
</script>

<div>
	<div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:var(--space-5);">
		<div>
			<h2 style="font-size:var(--text-xl);margin-bottom:2px;">All Epics</h2>
			<p style="font-size:var(--text-sm);color:var(--text-muted);margin:0;">{epics.length} epics</p>
		</div>
	</div>
	<div style="display:flex;flex-direction:column;gap:var(--space-4);">
		{#each epics as epic}
			{@const issues = issuesForEpic(epic.id)}
			{@const done = issues.filter((i: any) => i.status === 'done').length}
			{@const pts = issues.reduce((s: number, i: any) => s + (i.storyPoints ?? 0), 0)}
			{@const ptsDone = issues.filter((i: any) => i.status === 'done').reduce((s: number, i: any) => s + (i.storyPoints ?? 0), 0)}
			{@const sprintCount = [...new Set(issues.map((i: any) => i.sprintId).filter(Boolean))].length}
			<div class="glass-standard" style="cursor:pointer;" onclick={() => onNavigate({ view: 'epic', epic: epic.id })}>
				<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:var(--space-4);">
					<div>
						<div style="display:flex;align-items:center;gap:var(--space-2);margin-bottom:4px;">
							<span style="font-family:var(--font-mono);font-size:var(--text-sm);color:var(--accent-ember);font-weight:500;">E{String(epic.number).padStart(2, '0')}</span>
							<h3 style="font-size:var(--text-md);margin:0;">{epic.title}</h3>
							<Badge status={epic.status}/>
						</div>
						<div style="font-family:var(--font-mono);font-size:var(--text-xs);color:var(--text-muted);">
							{issues.length} issues · {sprintCount} sprints · {ptsDone}/{pts} pts · created {fmt.date(epic.createdAt)}
						</div>
					</div>
					<div style="color:var(--text-muted);font-family:var(--font-mono);font-size:var(--text-xs);">→</div>
				</div>
				<UsageBar value={done} max={issues.length || 1} sub="{done}/{issues.length} issues done" variant={epic.status === 'complete' ? 'ember' : ''}/>
			</div>
		{/each}
	</div>
</div>
