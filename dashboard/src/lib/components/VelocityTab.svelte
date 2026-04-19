<script lang="ts">
	interface SprintVelocity {
		sprintNumber: number;
		sprintTitle?: string;
		pointsCompleted: number;
		issuesCompleted: number;
		tokensUsed: number;
	}

	let { data }: { data: SprintVelocity[] } = $props();

	const maxIssues = $derived(Math.max(...data.map((s) => s.issuesCompleted), 1));
	const maxPoints = $derived(Math.max(...data.map((s) => s.pointsCompleted), 1));
	const chartH = 160;

	function fmtTokens(n: number): string {
		if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
		if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
		return String(n);
	}
</script>

<div>
	<!-- Section Header -->
	<div class="flex items-center gap-4 mb-8">
		<h2 class="font-syne text-3xl font-bold text-[#f0ede8]">Velocity</h2>
		<div class="glass-standard px-3 py-1 rounded-full text-sm">
			<span class="font-mono text-[#cbbdb8]">{data.length} sprints</span>
		</div>
	</div>

	<!-- Chart Card -->
	<div class="glass-enhanced p-6 mb-8">
		<div class="flex justify-between items-start mb-6">
			<div>
				<h3 class="font-syne font-bold text-lg text-[#f0ede8] uppercase tracking-wider">Sprint Velocity Trend</h3>
				<p class="text-sm text-[#a08880] mt-1">Issues completed vs story points per sprint</p>
			</div>
			<div class="flex gap-4 text-sm">
				<div class="flex items-center gap-2">
					<div class="w-3 h-3 rounded-sm bg-[#f07040]"></div>
					<span class="text-[#cbbdb8]">Issues</span>
				</div>
				<div class="flex items-center gap-2">
					<div class="w-3 h-3 rounded-sm bg-[#e8402a]"></div>
					<span class="text-[#cbbdb8]">Points</span>
				</div>
			</div>
		</div>

		<!-- Bar Chart -->
		<div class="relative border-b border-l border-white/10 px-8 pb-8 pt-4" style="height: {chartH + 48}px;">
			<!-- Grid lines -->
			{#each [0, 0.25, 0.5, 0.75, 1] as frac}
				<div
					class="absolute left-8 right-0 border-t border-white/5"
					style="bottom: {32 + frac * chartH}px"
				></div>
			{/each}
			<!-- Sprint clusters -->
			<div class="absolute left-8 right-8 flex items-end justify-around" style="bottom: 32px; height: {chartH}px;">
				{#each data as sprint}
					{@const issH = Math.max(Math.round((sprint.issuesCompleted / maxIssues) * chartH), sprint.issuesCompleted > 0 ? 2 : 0)}
					{@const ptsH = Math.max(Math.round((sprint.pointsCompleted / maxPoints) * chartH), sprint.pointsCompleted > 0 ? 2 : 0)}
					<div class="relative flex items-end gap-1 group cursor-crosshair">
						<!-- Issues bar -->
						<div
							class="w-5 rounded-t-sm bg-[#f07040]/80 hover:bg-[#f07040] transition-colors"
							style="height: {issH}px"
						>
							<div class="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-[#1e110d] border border-white/10 px-2 py-1 rounded text-xs font-mono text-[#f0ede8] whitespace-nowrap z-20 shadow-lg pointer-events-none">
								{sprint.issuesCompleted} issues · {sprint.pointsCompleted} pts
							</div>
						</div>
						<!-- Points bar -->
						<div
							class="w-5 rounded-t-sm bg-[#e8402a]/80 hover:bg-[#e8402a] transition-colors"
							style="height: {ptsH}px"
						></div>
						<span class="absolute -bottom-6 left-1/2 -translate-x-1/2 font-mono text-xs text-[#cbbdb8]">
							S{sprint.sprintNumber}
						</span>
					</div>
				{/each}
			</div>
		</div>
	</div>

	<!-- Summary Table -->
	<div class="glass-standard overflow-hidden">
		<table class="w-full text-left border-collapse">
			<thead>
				<tr class="border-b border-white/10">
					<th class="px-6 py-4 font-syne uppercase text-xs tracking-[0.07em] text-[#a08880]">Sprint</th>
					<th class="px-6 py-4 font-syne uppercase text-xs tracking-[0.07em] text-[#a08880]">Title</th>
					<th class="px-6 py-4 font-syne uppercase text-xs tracking-[0.07em] text-[#a08880] text-right">Issues Done</th>
					<th class="px-6 py-4 font-syne uppercase text-xs tracking-[0.07em] text-[#a08880] text-right">Points Done</th>
					<th class="px-6 py-4 font-syne uppercase text-xs tracking-[0.07em] text-[#a08880] text-right">Tokens Used</th>
				</tr>
			</thead>
			<tbody class="text-sm">
				{#each [...data].reverse() as sprint}
					<tr class="border-b border-white/5 table-row-hover transition-colors">
						<td class="px-6 py-4 font-mono text-[#e8402a]">S{sprint.sprintNumber}</td>
						<td class="px-6 py-4 text-[#f0ede8]">{sprint.sprintTitle ?? `Sprint ${sprint.sprintNumber}`}</td>
						<td class="px-6 py-4 font-mono text-[#cbbdb8] text-right">{sprint.issuesCompleted}</td>
						<td class="px-6 py-4 font-mono text-[#cbbdb8] text-right">{sprint.pointsCompleted}</td>
						<td class="px-6 py-4 font-mono text-[#cbbdb8] text-right">{fmtTokens(sprint.tokensUsed)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>
