<script lang="ts">
	let {
		value,
		max,
		size = 80,
		label,
		sub
	}: { value: number; max: number; size?: number; label?: string; sub?: string } = $props();

	let pct = $derived(max > 0 ? Math.min(1, value / max) : 0);
	let r = $derived((size - 8) / 2);
	let cx = $derived(size / 2);
	let cy = $derived(size / 2);
	let circ = $derived(2 * Math.PI * r);
	let offset = $derived(circ * (1 - pct));
</script>

<div style="display:flex;align-items:center;gap:var(--space-4);">
	<svg width={size} height={size} style="flex-shrink:0;">
		<circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,160,100,0.08)" stroke-width="6"/>
		<circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--accent-primary)" stroke-width="6"
			stroke-dasharray={circ} stroke-dashoffset={offset} stroke-linecap="round"
			transform="rotate(-90 {cx} {cy})"
			style="filter:drop-shadow(0 0 6px var(--accent-glow-strong));transition:stroke-dashoffset 0.6s ease;"/>
		<text x={cx} y={cy + 1} text-anchor="middle" dominant-baseline="middle"
			style="font-family:var(--font-mono);font-size:{size * 0.2}px;fill:var(--text-primary);font-weight:400;">
			{Math.round(pct * 100)}%
		</text>
	</svg>
	{#if label || sub}
		<div>
			{#if label}
				<div style="font-family:var(--font-body);font-size:var(--text-sm);color:var(--text-primary);">{label}</div>
			{/if}
			{#if sub}
				<div style="font-family:var(--font-mono);font-size:var(--text-xs);color:var(--text-muted);margin-top:2px;">{sub}</div>
			{/if}
		</div>
	{/if}
</div>
