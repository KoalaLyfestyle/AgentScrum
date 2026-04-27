<script lang="ts">
	import StatCard from './StatCard.svelte';
	import GroupedBarChart from './GroupedBarChart.svelte';
	import BarChart from './BarChart.svelte';
	import { fmt } from '$lib/utils/fmt.js';

	let { data }: { data: any } = $props();

	let chartMode = $state<'sprint' | 'calendar'>('sprint');

	let avgPts    = $derived(data.velocity.length ? Math.round(data.velocity.reduce((s: number, v: any) => s + v.pointsCompleted, 0) / data.velocity.length) : 0);
	let avgIssues = $derived(data.velocity.length ? Math.round(data.velocity.reduce((s: number, v: any) => s + v.issuesCompleted, 0) / data.velocity.length) : 0);
	let totalPts  = $derived(data.velocity.reduce((s: number, v: any) => s + v.pointsCompleted, 0));

	// Calendar data
	let calData = $derived(() => {
		const closedSprints = data.sprints
			.filter((s: any) => s.projectId === data.projectId && s.status === 'closed')
			.sort((a: any, b: any) => a.number - b.number);

		const monthMap: Record<string, { label: string; points: number; issues: number }> = {};
		closedSprints.forEach((sprint: any) => {
			if (!sprint.closedAt) return;
			const vel = data.velocity.find((v: any) => v.sprintNumber === sprint.number);
			if (!vel) return;
			const d = new Date(sprint.closedAt);
			const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
			const label = d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
			if (!monthMap[key]) monthMap[key] = { label, points: 0, issues: 0 };
			monthMap[key].points += vel.pointsCompleted;
			monthMap[key].issues += vel.issuesCompleted;
		});

		const allMonths = Object.keys(monthMap).sort();
		if (allMonths.length === 0) return [];
		const [sy, sm] = allMonths[0].split('-').map(Number);
		const [ey, em] = allMonths[allMonths.length - 1].split('-').map(Number);
		const result = [];
		let y = sy, m = sm;
		while (y < ey || (y === ey && m <= em)) {
			const key = `${y}-${String(m).padStart(2, '0')}`;
			const label = new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
			result.push({ label, value: monthMap[key]?.points ?? 0, issues: monthMap[key]?.issues ?? 0 });
			m++; if (m > 12) { m = 1; y++; }
		}
		return result;
	});
</script>

<div>
	<div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:var(--space-5);">
		<div>
			<h2 style="font-size:var(--text-xl);margin-bottom:2px;">Velocity</h2>
			<p style="font-size:var(--text-sm);color:var(--text-muted);margin:0;">Story points and issues completed per sprint</p>
		</div>
	</div>

	<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:var(--space-4);margin-bottom:var(--space-6);">
		<StatCard label="Avg Points / Sprint" value={avgPts}/>
		<StatCard label="Avg Issues / Sprint" value={avgIssues}/>
		<StatCard label="Total Points Shipped" value={totalPts}/>
	</div>

	<div class="glass-standard" style="margin-bottom:var(--space-5);">
		<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-4);">
			<div class="label-upper" style="font-size:10px;">
				{chartMode === 'sprint' ? 'Points & Issues — by sprint' : 'Points completed — by calendar month'}
			</div>
			<div style="display:flex;gap:var(--space-1);">
				{#each [['sprint', 'By Sprint'], ['calendar', 'By Month']] as [k, l]}
					<button class="btn btn-ghost {chartMode === k ? 'active-btn' : ''}" style="padding:5px 10px;font-size:var(--text-xs);" onclick={() => (chartMode = k as 'sprint' | 'calendar')}>{l}</button>
				{/each}
			</div>
		</div>
		{#if chartMode === 'sprint'}
			<GroupedBarChart data={data.velocity.map((v: any) => ({ label: `S${v.sprintNumber}`, issues: v.issuesCompleted, points: v.pointsCompleted }))} height={200}/>
		{:else}
			<BarChart data={calData()} valueKey="value" labelKey="label" color="var(--data-1)" height={180} slantLabels showArea/>
			<div style="display:flex;gap:var(--space-6);margin-top:var(--space-3);justify-content:center;">
				<span style="font-family:var(--font-mono);font-size:var(--text-xs);color:var(--text-muted);">Empty months = no sprint closed</span>
			</div>
		{/if}
	</div>

	<div class="glass-standard" style="padding:0;overflow-x:auto;">
		<table class="data-table">
			<thead>
				<tr>
					<th>Sprint</th><th>Title</th><th>Issues Done</th><th>Points Done</th><th>Tokens Used</th>
				</tr>
			</thead>
			<tbody>
				{#each data.velocity as v}
					<tr>
						<td>S{v.sprintNumber}</td>
						<td style="font-family:var(--font-body);color:var(--text-primary);">{v.sprintTitle ?? '—'}</td>
						<td>{v.issuesCompleted}</td>
						<td style="color:var(--data-5);">{v.pointsCompleted}</td>
						<td>{fmt.tokens(v.tokensUsed)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>
