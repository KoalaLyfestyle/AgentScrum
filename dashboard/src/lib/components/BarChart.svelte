<script lang="ts">
	let {
		data,
		valueKey = 'value',
		labelKey = 'label',
		color = 'var(--data-1)',
		height = 160,
		slantLabels = false
	}: {
		data: Record<string, any>[];
		valueKey?: string;
		labelKey?: string;
		color?: string;
		height?: number;
		slantLabels?: boolean;
	} = $props();

	let maxVal = $derived(Math.max(...data.map((d) => d[valueKey]), 1));
	let barW = $derived(Math.max(18, Math.min(44, 520 / data.length - 10)));
	let gap = 10;
	let totalW = $derived(data.length * (barW + gap) - gap);
	let padY = 28, padX = 8;
	let labelH = $derived(slantLabels ? 40 : 18);
	let gridLines = [0.25, 0.5, 0.75, 1];
</script>

<svg viewBox="0 0 {totalW + padX * 2} {height + padY + labelH}"
	style="width:100%;height:{height + padY + labelH}px;overflow:visible;">
	{#each gridLines as f}
		<line x1={padX} x2={totalW + padX} y1={padY + (1 - f) * height} y2={padY + (1 - f) * height}
			stroke="rgba(255,160,100,0.07)" stroke-width="1"/>
	{/each}
	{#each data as d, i}
		{@const x = padX + i * (barW + gap)}
		{@const barH = Math.max(2, (d[valueKey] / maxVal) * height)}
		{@const y = padY + height - barH}
		<rect {x} {y} width={barW} height={barH} fill={color} rx="3" opacity="0.85"
			style="filter:drop-shadow(0 0 5px {color}55);"/>
		<text x={x + barW / 2} y={padY + height + 14} text-anchor="middle"
			fill="var(--text-muted)" style="font-family:var(--font-mono);font-size:9px;"
			transform={slantLabels ? `rotate(-35,${x + barW / 2},${padY + height + 14})` : ''}>
			{d[labelKey]}
		</text>
	{/each}
</svg>
