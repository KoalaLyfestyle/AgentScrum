<script lang="ts">
	import Badge from './Badge.svelte';
	import { fmt } from '$lib/utils/fmt.js';

	let { data }: { data: any } = $props();

	let decisions = $derived(data.decisions ?? []);
</script>

<div>
	<div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:var(--space-5);">
		<div>
			<h2 style="font-size:var(--text-xl);margin-bottom:2px;">Architecture Decisions</h2>
			<p style="font-size:var(--text-sm);color:var(--text-muted);margin:0;">{decisions.length} accepted records</p>
		</div>
	</div>

	{#if decisions.length === 0}
		<div class="glass-standard" style="text-align:center;padding:var(--space-12);color:var(--text-muted);font-size:var(--text-sm);">No decisions logged yet.</div>
	{:else}
		<div style="display:flex;flex-direction:column;gap:var(--space-4);">
			{#each decisions as d}
				<div class="glass-standard">
					<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:var(--space-3);">
						<div>
							<div style="display:flex;align-items:center;gap:var(--space-2);margin-bottom:4px;">
								<span style="font-family:var(--font-mono);font-size:var(--text-xs);color:var(--text-muted);">{fmt.date(d.createdAt)}</span>
								<Badge status={d.status}/>
							</div>
							<h4 style="margin:0;font-size:var(--text-base);">{d.title}</h4>
						</div>
					</div>
					<div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-4);margin-top:var(--space-3);">
						{#each [['Context', d.context], ['Decision', d.decision], ['Rejected Alternatives', d.rejectedAlternatives], ['Consequences', d.consequences]].filter(([, v]) => v) as [k, v]}
							<div>
								<div style="font-family:var(--font-display);font-size:10px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-muted);margin-bottom:4px;">{k}</div>
								<p style="font-size:var(--text-sm);margin:0;line-height:1.6;">{v}</p>
							</div>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
