<script lang="ts">
	interface CostIssue {
		issueId: number;
		issueKey: string;
		title: string;
		assignedTo?: string;
		tokensUsed: number;
	}
	interface CostReport {
		sprintNumber: number;
		sprintTitle?: string;
		issues: CostIssue[];
		totalTokens: number;
	}
	interface RetroIssue {
		id: number;
		title: string;
		status: string;
	}
	interface Retro {
		sprintNumber: number;
		expensiveIssues: RetroIssue[];
	}
	interface VelocityItem {
		sprintNumber: number;
		tokensUsed: number;
	}

	let {
		costs,
		retro,
		velocity
	}: { costs: CostReport | null; retro: Retro | null; velocity: VelocityItem[] } = $props();

	const expensiveIds = $derived(new Set((retro?.expensiveIssues ?? []).map((i) => i.id)));

	const maxTokens = $derived(Math.max(...velocity.map((s) => s.tokensUsed), 1));

	function fmtTokens(n: number): string {
		if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
		if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
		return String(n);
	}

	// Sort issues by tokens desc
	const sortedIssues = $derived(
		costs ? [...costs.issues].sort((a, b) => b.tokensUsed - a.tokensUsed) : []
	);
</script>

<div>
	<!-- Section Header -->
	<div class="mb-8">
		<h2 class="font-syne text-3xl font-bold text-[#f0ede8] mb-1">Token Usage</h2>
		<p class="text-sm text-[#a08880]">AI agent execution metrics — tokens only, no dollar amounts</p>
	</div>

	<!-- Section 1: Sprint Token Trend -->
	<section class="glass-enhanced p-6 mb-8">
		<h3 class="font-syne font-bold text-[#e8402a] text-sm uppercase tracking-wider mb-6 flex items-center gap-2">
			Sprint Token Trend
		</h3>
		<div class="space-y-3">
			{#each velocity as sprint}
				{@const pct = Math.round((sprint.tokensUsed / maxTokens) * 100)}
				{@const isLatest = sprint.sprintNumber === Math.max(...velocity.map((s) => s.sprintNumber))}
				<div class="flex items-center gap-4">
					<div class="w-8 text-right font-mono text-xs {isLatest ? 'text-[#e8402a] font-bold' : 'text-[#a08880]'}">
						S{sprint.sprintNumber}
					</div>
					<div class="flex-1 h-6 bg-white/5 rounded-sm relative overflow-hidden">
						<div
							class="absolute top-0 left-0 h-full rounded-sm transition-all {isLatest
								? 'bg-gradient-to-r from-[#b53020] to-[#e8402a] shadow-[0_0_10px_rgba(232,64,42,0.5)]'
								: 'bg-gradient-to-r from-[#7a1f12] to-[#e8402a]/70'}"
							style="width: {pct}%"
						></div>
					</div>
					<div class="w-16 font-mono text-sm text-right {isLatest ? 'text-[#e8402a] font-bold' : 'text-[#f0ede8]'}">
						{fmtTokens(sprint.tokensUsed)}
					</div>
				</div>
			{/each}
		</div>
	</section>

	<!-- Sections 2 + 3 side by side (on large screens) -->
	<div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
		<!-- Model Distribution placeholder -->
		<section class="lg:col-span-4 glass-standard rounded-xl p-6 flex flex-col">
			<h3 class="font-syne font-bold text-[#f0ede8] text-sm uppercase tracking-wider mb-4">Model Distribution</h3>
			<!-- Segmented bar -->
			<div class="w-full h-3 flex rounded-full overflow-hidden mb-4">
				<div class="bg-[#e8402a] h-full" style="width: 80%"></div>
				<div class="bg-[#f07040] h-full" style="width: 20%"></div>
			</div>
			<table class="w-full text-left border-collapse text-sm">
				<thead>
					<tr class="border-b border-white/10">
						<th class="py-2 font-syne uppercase text-xs tracking-wider text-[#a08880] font-normal">Model</th>
						<th class="py-2 font-syne uppercase text-xs tracking-wider text-[#a08880] font-normal text-right">%</th>
					</tr>
				</thead>
				<tbody>
					<tr class="border-b border-white/5">
						<td class="py-2 flex items-center gap-2">
							<div class="w-2 h-2 rounded-full bg-[#e8402a]"></div>
							<span class="font-mono text-xs text-[#cbbdb8]">sonnet-4-6</span>
						</td>
						<td class="py-2 font-mono text-[#e8402a] text-right">80%</td>
					</tr>
					<tr>
						<td class="py-2 flex items-center gap-2">
							<div class="w-2 h-2 rounded-full bg-[#f07040]"></div>
							<span class="font-mono text-xs text-[#cbbdb8]">haiku-4-5</span>
						</td>
						<td class="py-2 font-mono text-[#f07040] text-right">20%</td>
					</tr>
				</tbody>
			</table>
			<p class="text-xs text-[#a08880] mt-4">Distribution sourced from <code class="font-mono">sessions.model</code></p>
		</section>

		<!-- Per-Issue Table -->
		<section class="lg:col-span-8 glass-standard overflow-hidden flex flex-col">
			<div class="px-6 py-4 border-b border-white/10 flex justify-between items-center">
				<h3 class="font-syne font-bold text-[#f0ede8] text-sm uppercase tracking-wider">
					Per-Issue Consumption
					{#if costs}— Sprint {costs.sprintNumber}{/if}
				</h3>
				<span class="font-mono text-xs text-[#a08880]">sorted by tokens ↓</span>
			</div>
			<div class="overflow-x-auto">
				<table class="w-full text-left border-collapse min-w-[500px]">
					<thead>
						<tr class="border-b border-white/10">
							<th class="py-3 px-4 font-syne uppercase text-xs tracking-wider text-[#a08880] font-normal w-24">Key</th>
							<th class="py-3 px-4 font-syne uppercase text-xs tracking-wider text-[#a08880] font-normal">Title</th>
							<th class="py-3 px-4 font-syne uppercase text-xs tracking-wider text-[#a08880] font-normal text-right w-28">Tokens</th>
							<th class="py-3 px-4 font-syne uppercase text-xs tracking-wider text-[#a08880] font-normal w-16 text-center">🔥</th>
						</tr>
					</thead>
					<tbody>
						{#each sortedIssues as issue}
							{@const expensive = expensiveIds.has(issue.issueId)}
							<tr class="border-b border-white/5 table-row-hover transition-colors">
								<td class="py-3 px-4 font-mono text-xs text-[#cbbdb8]">{issue.issueKey}</td>
								<td class="py-3 px-4 text-[#f0ede8] text-sm truncate max-w-[200px]">{issue.title}</td>
								<td class="py-3 px-4 font-mono text-sm text-right {expensive ? 'text-[#e8402a] font-bold' : 'text-[#cbbdb8]'}">
									{fmtTokens(issue.tokensUsed)}
								</td>
								<td class="py-3 px-4 text-center">
									{#if expensive}
										<span class="inline-flex items-center justify-center px-2 py-0.5 rounded bg-[#fb923c]/20 text-[#fb923c] font-mono text-xs border border-[#fb923c]/30">2×🔥</span>
									{/if}
								</td>
							</tr>
						{/each}
						{#if sortedIssues.length === 0}
							<tr><td colspan="4" class="px-4 py-6 text-center text-sm text-[#a08880]">No data for active sprint</td></tr>
						{/if}
					</tbody>
				</table>
			</div>
		</section>
	</div>
</div>
