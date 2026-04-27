<script lang="ts">
	import { fmt } from '$lib/utils/fmt.js';

	let {
		label,
		value,
		max,
		sub,
		variant = ''
	}: { label: string; value: number; max: number; sub?: string; variant?: string } = $props();

	let pct = $derived(max > 0 ? Math.min(100, (value / max) * 100) : 0);
	let fillCls = $derived(
		variant === 'ember' ? 'usage-bar-fill usage-bar-fill-ember'
		: variant === 'muted' ? 'usage-bar-fill usage-bar-fill-muted'
		: 'usage-bar-fill'
	);
</script>

<div class="usage-bar">
	<div class="usage-bar-header">
		<span style="font-family:var(--font-body);font-size:var(--text-sm);color:var(--text-secondary);">{label}</span>
		<span style="font-family:var(--font-mono);font-size:var(--text-xs);color:var(--text-muted);">{sub ?? fmt.tokens(value)}</span>
	</div>
	<div class="usage-bar-track">
		<div class={fillCls} style="width:{pct}%;"></div>
	</div>
</div>
