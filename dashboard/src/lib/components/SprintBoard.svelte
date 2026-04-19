<script lang="ts">
	interface Issue {
		id: number;
		key: string;
		title: string;
		type: string;
		status: string;
		priority: string;
		storyPoints: number | null;
		assignedTo: string | null;
		tokensUsed: number;
		blockerReason: string | null;
	}

	interface SprintData {
		sprint: { number: number; title?: string; goal?: string; status: string; startedAt?: string };
		summary: { total: number; byStatus: Record<string, number> };
		issues: Issue[];
		isClosed: boolean;
	}

	let { data }: { data: SprintData } = $props();

	function statusBadge(status: string): string {
		const map: Record<string, string> = {
			done: 'badge-done',
			in_progress: 'badge-inprogress',
			review: 'badge-review',
			blocked: 'badge-blocked',
			todo: 'badge-todo'
		};
		return `badge ${map[status] ?? 'badge-todo'}`;
	}

	function statusLabel(status: string): string {
		return status === 'in_progress' ? 'In Progress' : status.charAt(0).toUpperCase() + status.slice(1);
	}

	function fmtTokens(n: number): string {
		if (n === 0) return '—';
		return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);
	}

	const statCards = $derived([
		{ label: 'Todo', key: 'todo', color: 'text-[#a08880]', borderTop: 'rgba(160,136,128,0.2)' },
		{ label: 'In Progress', key: 'in_progress', color: 'text-[#e8402a]', borderTop: 'rgba(232,64,42,0.4)' },
		{ label: 'Review', key: 'review', color: 'text-[#fbbf24]', borderTop: 'rgba(251,191,36,0.3)' },
		{ label: 'Done', key: 'done', color: 'text-[#34d399]', borderTop: 'rgba(52,211,153,0.3)' },
		{ label: 'Blocked', key: 'blocked', color: 'text-[#fb923c]', borderTop: 'rgba(251,146,60,0.4)' }
	]);
</script>

<div>
	<!-- Sprint Header -->
	<div class="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-white/10 pb-6">
		<div>
			<div class="flex items-center gap-3 mb-2">
				<h2 class="font-syne text-3xl font-bold text-[#f0ede8]">
					Sprint {data.sprint.number}{data.sprint.title ? `: ${data.sprint.title}` : ''}
				</h2>
				<span class="{statusBadge(data.sprint.status)}">{statusLabel(data.sprint.status)}</span>
			</div>
			{#if data.sprint.goal}
				<div class="text-[#cbbdb8] text-sm">
					<span class="font-syne uppercase text-xs tracking-widest text-[#a08880] mr-2">Goal:</span>
					{data.sprint.goal}
				</div>
			{/if}
		</div>
		{#if data.sprint.startedAt}
			<div class="text-right">
				<div class="font-syne uppercase text-xs tracking-widest text-[#a08880] mb-1">Started</div>
				<div class="font-mono text-sm text-[#cbbdb8]">{data.sprint.startedAt.slice(0, 10)}</div>
			</div>
		{/if}
	</div>

	<!-- Stat Cards -->
	<div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
		{#each statCards as card}
			<div class="glass-enhanced p-4 flex flex-col gap-2" style="border-top-color: {card.borderTop}">
				<div class="font-syne uppercase text-xs tracking-widest text-[#a08880]">{card.label}</div>
				<div class="font-mono text-3xl {card.color}">{data.summary.byStatus[card.key] ?? 0}</div>
			</div>
		{/each}
	</div>

	<!-- Closed Banner -->
	{#if data.isClosed}
		<div class="mb-4 px-4 py-2 rounded border border-[#fbbf24]/30 bg-[#fbbf24]/10 text-[#fbbf24] font-syne text-xs uppercase tracking-wider">
			Viewing Closed Sprint — No active sprint
		</div>
	{/if}

	<!-- Issue Table -->
	<div class="glass-standard overflow-hidden">
		<table class="w-full text-left border-collapse">
			<thead>
				<tr class="border-b border-white/10">
					<th class="py-4 px-4 font-syne uppercase text-xs tracking-[0.07em] text-[#a08880] w-24">Key</th>
					<th class="py-4 px-4 font-syne uppercase text-xs tracking-[0.07em] text-[#a08880]">Title</th>
					<th class="py-4 px-4 font-syne uppercase text-xs tracking-[0.07em] text-[#a08880] w-24">Type</th>
					<th class="py-4 px-4 font-syne uppercase text-xs tracking-[0.07em] text-[#a08880] w-24">Priority</th>
					<th class="py-4 px-4 font-syne uppercase text-xs tracking-[0.07em] text-[#a08880] w-20 text-center">Pts</th>
					<th class="py-4 px-4 font-syne uppercase text-xs tracking-[0.07em] text-[#a08880] w-32">Status</th>
					<th class="py-4 px-4 font-syne uppercase text-xs tracking-[0.07em] text-[#a08880] w-32">Assigned</th>
					<th class="py-4 px-4 font-syne uppercase text-xs tracking-[0.07em] text-[#a08880] w-24 text-right">Tokens</th>
				</tr>
			</thead>
			<tbody class="text-sm">
				{#each data.issues as issue}
					<tr
						class="border-b border-white/5 transition-colors {issue.status === 'blocked' ? '' : 'table-row-hover'}"
						style={issue.status === 'blocked'
							? 'border-left: 3px solid #fb923c; background-color: rgba(251,146,60,0.05);'
							: ''}
					>
						<td class="py-3 px-4 font-mono text-[#e8402a] text-xs">{issue.key}</td>
						<td class="py-3 px-4 text-[#f0ede8]">{issue.title}</td>
						<td class="py-3 px-4 text-[#cbbdb8] capitalize">{issue.type}</td>
						<td class="py-3 px-4 text-[#cbbdb8] capitalize">{issue.priority}</td>
						<td class="py-3 px-4 font-mono text-[#cbbdb8] text-center">{issue.storyPoints ?? '—'}</td>
						<td class="py-3 px-4"><span class={statusBadge(issue.status)}>{statusLabel(issue.status)}</span></td>
						<td class="py-3 px-4 text-[#cbbdb8]">{issue.assignedTo ?? '—'}</td>
						<td class="py-3 px-4 font-mono text-[#cbbdb8] text-right">{fmtTokens(issue.tokensUsed)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>
