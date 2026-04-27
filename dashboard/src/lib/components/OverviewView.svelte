<script lang="ts">
	import StatCard from './StatCard.svelte';
	import UsageBar from './UsageBar.svelte';
	import ProgressRing from './ProgressRing.svelte';
	import GroupedBarChart from './GroupedBarChart.svelte';
	import Badge from './Badge.svelte';
	import { fmt } from '$lib/utils/fmt.js';

	let {
		data,
		onNavigate,
		onIssueSelect
	}: {
		data: any;
		onNavigate: (p: { view: string; sprint?: number; epic?: number }) => void;
		onIssueSelect: (i: any) => void;
	} = $props();

	let projectId = $derived(data.projectId);
	let project = $derived(data.projects.find((p: any) => p.id === projectId));
	let projectEpics = $derived(data.epics.filter((e: any) => e.projectId === projectId));
	let projectSprints = $derived(data.sprints.filter((s: any) => s.projectId === projectId));
	let activeSprint = $derived(projectSprints.find((s: any) => s.status === 'active'));
	let closedSprints = $derived(projectSprints.filter((s: any) => s.status === 'closed'));
	let allIssues = $derived(data.issues.filter((i: any) => {
		const ep = data.epics.find((e: any) => e.id === i.epicId);
		return ep && ep.projectId === projectId;
	}));
	let activeIssues = $derived(activeSprint ? allIssues.filter((i: any) => i.sprintId === activeSprint.id) : []);
	let sprintPts = $derived(activeIssues.reduce((s: number, i: any) => s + (i.storyPoints ?? 0), 0));
	let sprintPtsDone = $derived(activeIssues.filter((i: any) => i.status === 'done').reduce((s: number, i: any) => s + (i.storyPoints ?? 0), 0));
	let totalTokens = $derived(allIssues.reduce((s: number, i: any) => s + i.tokensUsed, 0));
	let avgVelocity = $derived(data.velocity.length ? Math.round(data.velocity.reduce((s: number, v: any) => s + v.pointsCompleted, 0) / data.velocity.length) : 0);

	let recentSessions = $derived(
		data.sessions
			.filter((s: any) => allIssues.find((i: any) => i.id === s.issueId))
			.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
			.slice(0, 5)
	);

	let statusLabels = [
		['todo', 'To Do'],
		['in_progress', 'Active'],
		['review', 'Review'],
		['done', 'Done'],
		['blocked', 'Blocked'],
	] as const;

	// Issues to highlight in the sprint card — prioritise active/review/blocked, then todo, then done
	let sprintHighlightIssues = $derived(() => {
		const order = { blocked: 0, in_progress: 1, review: 2, todo: 3, done: 4 };
		return [...activeIssues]
			.sort((a, b) => (order[a.status as keyof typeof order] ?? 5) - (order[b.status as keyof typeof order] ?? 5))
			.slice(0, 4);
	});

	function statusColor(s: string) {
		return s === 'blocked' ? 'var(--status-error)'
			: s === 'done' ? 'var(--status-success)'
			: s === 'in_progress' ? 'var(--accent-primary)'
			: s === 'review' ? 'var(--status-warning)'
			: 'var(--text-muted)';
	}

	function statusDot(s: string) {
		return s === 'blocked' ? '⬡' : s === 'done' ? '✓' : s === 'in_progress' ? '◉' : s === 'review' ? '◈' : '○';
	}
</script>

<div>
	<!-- Section Header -->
	<div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:var(--space-5);">
		<div>
			<h2 style="font-size:var(--text-xl);margin-bottom:2px;">{project?.name}</h2>
			<p style="font-size:var(--text-sm);color:var(--text-muted);margin:0;">
				{closedSprints.length} closed sprints · {projectEpics.length} epics · {allIssues.length} issues
			</p>
		</div>
	</div>

	<!-- Stat cards -->
	<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:var(--space-4);margin-bottom:var(--space-6);">
		<StatCard label="Total Issues" value={allIssues.length} sub="{allIssues.filter((i: any) => i.status === 'done').length} done"/>
		<StatCard label="Sprints" value={closedSprints.length} sub="+1 active"/>
		<StatCard label="Total Tokens" value={fmt.tokens(totalTokens)} sub="all time"/>
		<StatCard label="Avg Velocity" value={avgVelocity} sub="pts / sprint"/>
	</div>

	<!-- Active sprint + Epic progress -->
	<div style="display:grid;grid-template-columns:1.4fr 1fr;gap:var(--space-5);margin-bottom:var(--space-5);">
		<div class="glass-standard">
			<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-3);">
				<div>
					<div class="label-upper" style="font-size:10px;margin-bottom:4px;">Active Sprint</div>
					<h4 style="margin:0;">{activeSprint?.title ?? 'No active sprint'}</h4>
				</div>
				{#if activeSprint}
					<button class="btn btn-ghost" style="font-size:var(--text-xs);padding:6px 12px;" onclick={() => onNavigate({ view: 'sprint', sprint: activeSprint.id })}>View board →</button>
				{/if}
			</div>
			{#if activeSprint}
				<!-- Sprint goal callout -->
				{#if activeSprint.goal}
					<div style="
						border-left: 2px solid var(--accent-primary);
						padding: var(--space-2) var(--space-3);
						background: rgba(232,64,42,0.06);
						border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
						margin-bottom: var(--space-4);
					">
						<div style="font-family:var(--font-display);font-size:9px;letter-spacing:0.08em;text-transform:uppercase;color:var(--accent-ember);margin-bottom:3px;">Sprint Goal</div>
						<div style="font-family:var(--font-body);font-size:var(--text-sm);color:var(--text-secondary);line-height:1.4;">{activeSprint.goal}</div>
					</div>
				{/if}

				<!-- Progress ring + status grid -->
				<ProgressRing value={sprintPtsDone} max={sprintPts} size={68}
					label="{sprintPts} story points"
					sub="{sprintPtsDone} done · {sprintPts - sprintPtsDone} remaining"/>
				<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:var(--space-2);margin-top:var(--space-4);">
					{#each statusLabels as [s, l]}
						{@const count = activeIssues.filter((i: any) => i.status === s).length}
						<div style="text-align:center;">
							<div style="font-family:var(--font-mono);font-size:var(--text-lg);color:{s === 'blocked' ? 'var(--status-error)' : s === 'done' ? 'var(--status-success)' : s === 'in_progress' ? 'var(--accent-primary)' : 'var(--text-primary)'};">{count}</div>
							<div style="font-family:var(--font-display);font-size:9px;letter-spacing:0.06em;text-transform:uppercase;color:var(--text-muted);margin-top:2px;">{l}</div>
						</div>
					{/each}
				</div>

				<!-- Issue mini-list -->
				{#if sprintHighlightIssues().length > 0}
					<div style="margin-top:var(--space-4);padding-top:var(--space-4);border-top:1px solid var(--border-subtle);">
						<div style="font-family:var(--font-display);font-size:9px;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-muted);margin-bottom:var(--space-3);">Issues</div>
						<div style="display:flex;flex-direction:column;gap:var(--space-2);">
							{#each sprintHighlightIssues() as issue}
								{@const epic = data.epics.find((e: any) => e.id === issue.epicId)}
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<div
									style="display:flex;align-items:center;gap:var(--space-2);padding:var(--space-2) var(--space-3);background:rgba(255,140,80,0.04);border-radius:var(--radius-sm);border:1px solid var(--border-subtle);cursor:pointer;transition:background 0.15s ease;"
									onclick={() => onIssueSelect(issue)}
									onmouseenter={(e) => (e.currentTarget as HTMLElement).style.background='rgba(255,140,80,0.08)'}
									onmouseleave={(e) => (e.currentTarget as HTMLElement).style.background='rgba(255,140,80,0.04)'}
									role="button"
									tabindex="0"
									onkeydown={(e) => e.key === 'Enter' && onIssueSelect(issue)}
								>
									<span style="font-size:12px;color:{statusColor(issue.status)};flex-shrink:0;">{statusDot(issue.status)}</span>
									{#if epic}
										<span style="font-family:var(--font-mono);font-size:9px;color:var(--accent-ember);flex-shrink:0;">E{String(epic.number).padStart(2,'0')}-I{String(issue.number).padStart(2,'0')}</span>
									{/if}
									<span style="font-family:var(--font-body);font-size:var(--text-xs);color:var(--text-secondary);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{issue.title}</span>
									{#if issue.storyPoints}
										<span style="font-family:var(--font-mono);font-size:9px;color:var(--text-muted);flex-shrink:0;">{issue.storyPoints}pt</span>
									{/if}
								</div>
							{/each}
						</div>
					</div>
				{/if}
			{/if}
		</div>

		<div class="glass-standard">
			<div class="label-upper" style="font-size:10px;margin-bottom:var(--space-4);">Epic Progress</div>
			<div style="display:flex;flex-direction:column;gap:var(--space-4);">
				{#each projectEpics as epic}
					{@const eIssues = allIssues.filter((i: any) => i.epicId === epic.id)}
					{@const done = eIssues.filter((i: any) => i.status === 'done').length}
					<div style="cursor:pointer;" onclick={() => onNavigate({ view: 'epic', epic: epic.id })}>
						<div style="display:flex;align-items:center;gap:var(--space-2);margin-bottom:var(--space-2);">
							<span style="font-family:var(--font-mono);font-size:var(--text-xs);color:var(--accent-ember);">E{String(epic.number).padStart(2, '0')}</span>
							<span style="font-family:var(--font-body);font-size:var(--text-sm);color:var(--text-primary);flex:1;">{epic.title}</span>
							<Badge status={epic.status}/>
						</div>
						<UsageBar value={done} max={eIssues.length || 1} sub="{done}/{eIssues.length}" variant={epic.status === 'complete' ? 'ember' : ''}/>
					</div>
				{/each}
			</div>
		</div>
	</div>

	<!-- Velocity mini + Recent sessions -->
	<div style="display:grid;grid-template-columns:1.4fr 1fr;gap:var(--space-5);">
		<div class="glass-standard">
			<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-4);">
				<div class="label-upper" style="font-size:10px;">Velocity (closed sprints)</div>
				<button class="btn btn-ghost" style="font-size:var(--text-xs);padding:6px 12px;" onclick={() => onNavigate({ view: 'velocity' })}>Full chart →</button>
			</div>
			<GroupedBarChart data={data.velocity.map((v: any) => ({ label: `S${v.sprintNumber}`, issues: v.issuesCompleted, points: v.pointsCompleted }))} height={130}/>
		</div>

		<div class="glass-standard">
			<div class="label-upper" style="font-size:10px;margin-bottom:var(--space-3);">Recent Sessions</div>
			<div style="display:flex;flex-direction:column;gap:var(--space-3);">
				{#each recentSessions as s}
					{@const issue = allIssues.find((i: any) => i.id === s.issueId)}
					<div style="display:flex;gap:var(--space-3);align-items:flex-start;">
						<div style="width:6px;height:6px;border-radius:50%;background:var(--accent-primary);flex-shrink:0;margin-top:6px;"></div>
						<div style="flex:1;min-width:0;">
							<div style="font-family:var(--font-body);font-size:var(--text-xs);color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{issue?.title ?? '—'}</div>
							<div style="font-family:var(--font-mono);font-size:10px;color:var(--text-muted);margin-top:2px;">{fmt.tokens(s.tokensUsed)} tok · {fmt.ago(s.createdAt)}</div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	</div>
</div>
