<script lang="ts">
	import StatCard from './StatCard.svelte';
	import UsageBar from './UsageBar.svelte';
	import BarChart from './BarChart.svelte';
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

	let activeSprint = $derived(data.sprints.find((s: any) => s.projectId === data.projectId && s.status === 'active'));
	let sprintIssues = $derived(activeSprint ? data.issues.filter((i: any) => i.sprintId === activeSprint.id) : []);

	let median = $derived(() => {
		const vals = sprintIssues.map((i: any) => i.tokensUsed).filter((t: number) => t > 0).sort((a: number, b: number) => a - b);
		if (!vals.length) return 0;
		const m = Math.floor(vals.length / 2);
		return vals.length % 2 === 0 ? (vals[m - 1] + vals[m]) / 2 : vals[m];
	});

	let totalModel = $derived(data.modelDistribution.reduce((s: number, m: any) => s + m.tokensUsed, 0));
	let allTimeTokens = $derived(
		data.velocity.reduce((s: number, v: any) => s + v.tokensUsed, 0) +
		sprintIssues.reduce((s: number, i: any) => s + i.tokensUsed, 0)
	);

	function epicForIssue(issue: any) {
		return data.epics.find((e: any) => e.id === issue.epicId);
	}
</script>

<div>
	<div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:var(--space-5);">
		<div>
			<h2 style="font-size:var(--text-xl);margin-bottom:2px;">Token Usage</h2>
			<p style="font-size:var(--text-sm);color:var(--text-muted);margin:0;">Where tokens are going across sprints and issues</p>
		</div>
	</div>

	<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:var(--space-4);margin-bottom:var(--space-6);">
		<StatCard label="All-time Tokens" value={fmt.tokens(allTimeTokens)}/>
		<StatCard label="Active Sprint" value={fmt.tokens(sprintIssues.reduce((s: number, i: any) => s + i.tokensUsed, 0))}/>
		<StatCard label="Models Used" value={data.modelDistribution.length}/>
	</div>

	<div style="display:grid;grid-template-columns:1.4fr 1fr;gap:var(--space-5);margin-bottom:var(--space-5);">
		<div class="glass-standard">
			<div class="label-upper" style="font-size:10px;margin-bottom:var(--space-4);">Tokens per Closed Sprint</div>
			<BarChart data={data.velocity.map((v: any) => ({ label: `S${v.sprintNumber}`, value: v.tokensUsed }))} valueKey="value" labelKey="label" color="var(--data-2)" height={160}/>
		</div>
		<div class="glass-standard">
			<div class="label-upper" style="font-size:10px;margin-bottom:var(--space-4);">Model Distribution</div>
			<div style="display:flex;flex-direction:column;gap:var(--space-4);">
				{#each data.modelDistribution as m, i}
					<UsageBar
						label={m.model.replace('claude-', '')}
						value={m.tokensUsed}
						max={totalModel}
						sub="{fmt.tokens(m.tokensUsed)} · {m.sessions} sessions"
						variant={i === 0 ? '' : i === 1 ? 'ember' : 'muted'}
					/>
				{/each}
			</div>
		</div>
	</div>

	{#if activeSprint}
		<div>
			<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-3);">
				<div class="label-upper" style="font-size:10px;">Per-Issue Tokens — {activeSprint.title}</div>
				<span style="font-family:var(--font-mono);font-size:var(--text-xs);color:var(--text-muted);">⚠ = &gt;2× median ({fmt.tokens(median())})</span>
			</div>
			<div class="glass-standard" style="padding:0;overflow-x:auto;">
				<table class="data-table">
					<thead>
						<tr><th>Key</th><th>Title</th><th>Status</th><th>Tokens Used</th><th>Agent</th><th>Pts</th></tr>
					</thead>
					<tbody>
						{#each sprintIssues as issue}
							{@const epic = epicForIssue(issue)}
							{@const over = issue.tokensUsed > median() * 2 && issue.tokensUsed > 0}
							<tr onclick={() => onIssueSelect(issue)} style="cursor:pointer;">
								<td>{#if epic}<IssueKey epicNum={epic.number} issueNum={issue.number}/>{/if}</td>
								<td style="font-family:var(--font-body);color:var(--text-primary);max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{issue.title}</td>
								<td><Badge status={issue.status}/></td>
								<td style="color:{over ? 'var(--status-error)' : 'var(--text-secondary)'};">{fmt.tokens(issue.tokensUsed)}{over ? ' ⚠' : ''}</td>
								<td style="font-size:10px;">{issue.assignedTo ? issue.assignedTo.replace('claude-', '') : '—'}</td>
								<td>{issue.storyPoints ?? '—'}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}
</div>
