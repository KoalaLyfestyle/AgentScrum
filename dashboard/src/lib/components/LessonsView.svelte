<script lang="ts">
	import { fmt } from '$lib/utils/fmt.js';

	let { data }: { data: any } = $props();

	let lessons = $derived(data.lessons ?? []);
</script>

<div>
	<div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:var(--space-5);">
		<div>
			<h2 style="font-size:var(--text-xl);margin-bottom:2px;">Lessons Learned</h2>
			<p style="font-size:var(--text-sm);color:var(--text-muted);margin:0;">{lessons.length} post-mortems</p>
		</div>
	</div>

	{#if lessons.length === 0}
		<div class="glass-standard" style="text-align:center;padding:var(--space-12);color:var(--text-muted);font-size:var(--text-sm);">No lessons logged yet.</div>
	{:else}
		<div style="display:flex;flex-direction:column;gap:var(--space-4);">
			{#each lessons as l}
				<div class="glass-standard">
					<div style="display:flex;align-items:center;gap:var(--space-2);margin-bottom:var(--space-3);">
						<h4 style="margin:0;flex:1;">{l.title}</h4>
						<span style="font-family:var(--font-mono);font-size:var(--text-xs);color:var(--text-muted);">{fmt.date(l.createdAt)}</span>
						{#if l.tags}
							<div style="display:flex;gap:var(--space-1);">
								{#each l.tags.split(',') as tag}
									<span class="chip">{tag.trim()}</span>
								{/each}
							</div>
						{/if}
					</div>
					<div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-4);">
						<div>
							<div style="font-family:var(--font-display);font-size:10px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:var(--status-error);margin-bottom:4px;">What Failed</div>
							<p style="font-size:var(--text-sm);margin:0;">{l.whatFailed}</p>
						</div>
						<div>
							<div style="font-family:var(--font-display);font-size:10px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:var(--status-success);margin-bottom:4px;">Don't Repeat</div>
							<p style="font-size:var(--text-sm);margin:0;">{l.dontRepeat}</p>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
