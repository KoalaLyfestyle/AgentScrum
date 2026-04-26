<script lang="ts">
	let {
		value,
		max,
		size = 80,
		label,
		sub
	}: { value: number; max: number; size?: number; label?: string; sub?: string } = $props();

	let pct = $derived(max > 0 ? Math.min(1, value / max) : 0);
	let strokeW = $derived(Math.max(4, size * 0.09));
	let r = $derived((size - strokeW) / 2);
	let cx = $derived(size / 2);
	let cy = $derived(size / 2);
	let circ = $derived(2 * Math.PI * r);
	let offset = $derived(circ * (1 - pct));
	let gradId = $derived(`pr-grad-${size}`);

	// Color shifts: grey → ember → crimson based on pct
	let ringColor = $derived(
		pct >= 1 ? 'var(--status-success)'
		: pct > 0.6 ? 'var(--accent-ember)'
		: 'var(--accent-primary)'
	);
	let glowColor = $derived(
		pct >= 1 ? 'rgba(52,211,153,0.35)'
		: pct > 0.6 ? 'rgba(240,112,64,0.35)'
		: 'rgba(232,64,42,0.30)'
	);
</script>

<div style="display:flex;align-items:center;gap:var(--space-4);">
	<svg width={size} height={size} style="flex-shrink:0;overflow:visible;" role="img">
		<defs>
			<linearGradient id={gradId} x1="1" y1="0" x2="0" y2="1">
				<stop offset="0%" stop-color="var(--accent-ember)" stop-opacity="1"/>
				<stop offset="100%" stop-color={ringColor} stop-opacity="0.8"/>
			</linearGradient>
		</defs>
		<!-- Track -->
		<circle {cx} {cy} r={r} fill="none"
			stroke="rgba(255,160,100,0.07)" stroke-width={strokeW}/>
		<!-- Background glow -->
		{#if pct > 0}
			<circle {cx} {cy} r={r} fill="none"
				stroke={glowColor} stroke-width={strokeW + 4}
				stroke-dasharray={circ} stroke-dashoffset={offset}
				stroke-linecap="round"
				transform="rotate(-90 {cx} {cy})"
				style="filter:blur(4px);transition:stroke-dashoffset 0.7s cubic-bezier(0.16,1,0.3,1);"/>
		{/if}
		<!-- Main ring -->
		<circle {cx} {cy} r={r} fill="none"
			stroke="url(#{gradId})" stroke-width={strokeW}
			stroke-dasharray={circ} stroke-dashoffset={offset}
			stroke-linecap="round"
			transform="rotate(-90 {cx} {cy})"
			style="transition:stroke-dashoffset 0.7s cubic-bezier(0.16,1,0.3,1);"/>
		<!-- Percentage text -->
		<text x={cx} y={cy + 1} text-anchor="middle" dominant-baseline="middle"
			style="font-family:var(--font-mono);font-size:{size * 0.19}px;fill:var(--text-primary);font-weight:400;letter-spacing:-0.02em;">
			{Math.round(pct * 100)}%
		</text>
	</svg>
	{#if label || sub}
		<div>
			{#if label}
				<div style="font-family:var(--font-body);font-size:var(--text-sm);color:var(--text-primary);font-weight:500;">{label}</div>
			{/if}
			{#if sub}
				<div style="font-family:var(--font-mono);font-size:var(--text-xs);color:var(--text-muted);margin-top:3px;">{sub}</div>
			{/if}
		</div>
	{/if}
</div>
