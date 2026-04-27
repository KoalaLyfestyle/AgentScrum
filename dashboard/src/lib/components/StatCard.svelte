<script lang="ts">
	let { label, value, sub }: { label: string; value: string | number; sub?: string } = $props();
</script>

<div class="glass-standard glass-sm" style="display:flex;flex-direction:column;gap:4px;">
	<div class="label-upper" style="font-size:10px;">{label}</div>
	<div class="stat-number" style="font-size:var(--text-2xl);">{value}</div>
	{#if sub}
		<div style="font-family:var(--font-mono);font-size:var(--text-xs);color:var(--text-muted);margin-top:2px;">{sub}</div>
	{/if}
</div>
