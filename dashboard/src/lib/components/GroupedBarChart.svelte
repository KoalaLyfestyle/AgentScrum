<script lang="ts">
	let {
		data,
		height = 180
	}: { data: { label: string; issues: number; points: number }[]; height?: number } = $props();

	let maxI = $derived(Math.max(...data.map((d) => d.issues), 1));
	let maxP = $derived(Math.max(...data.map((d) => d.points), 1));
	let barW = 16, gap = 4, groupGap = 14;
	let groupW = barW * 2 + gap;
	let totalW = $derived(data.length * (groupW + groupGap) - groupGap);
	let padY = 28, padX = 10;
	let gridLines = [0.25, 0.5, 0.75, 1];
</script>

<svg viewBox="0 0 {totalW + padX * 2} {height + padY + 16}"
	style="width:100%;height:{height + padY + 16}px;overflow:visible;">
	{#each gridLines as f}
		<line x1={padX} x2={totalW + padX} y1={padY + (1 - f) * height} y2={padY + (1 - f) * height}
			stroke="rgba(255,160,100,0.07)" stroke-width="1"/>
	{/each}
	<!-- legend -->
	<rect x={padX} y="4" width="10" height="10" fill="var(--data-1)" rx="2"/>
	<text x={padX + 14} y="13" fill="var(--text-muted)" style="font-family:var(--font-mono);font-size:10px;">Issues</text>
	<rect x={padX + 62} y="4" width="10" height="10" fill="var(--data-5)" rx="2" opacity="0.8"/>
	<text x={padX + 76} y="13" fill="var(--text-muted)" style="font-family:var(--font-mono);font-size:10px;">Points</text>

	{#each data as d, i}
		{@const gx = padX + i * (groupW + groupGap)}
		{@const iH = Math.max(2, (d.issues / maxI) * height)}
		{@const pH = Math.max(2, (d.points / maxP) * height)}
		<rect x={gx}           y={padY + height - iH} width={barW} height={iH} fill="var(--data-1)" rx="3" opacity="0.85"/>
		<rect x={gx + barW + gap} y={padY + height - pH} width={barW} height={pH} fill="var(--data-5)" rx="3" opacity="0.75"/>
		<text x={gx + groupW / 2} y={padY + height + 14} text-anchor="middle"
			fill="var(--text-muted)" style="font-family:var(--font-mono);font-size:9px;">{d.label}</text>
		<text x={gx + barW / 2}          y={padY + height - iH - 4} text-anchor="middle"
			fill="var(--text-secondary)" style="font-family:var(--font-mono);font-size:9px;">{d.issues}</text>
		<text x={gx + barW + gap + barW / 2} y={padY + height - pH - 4} text-anchor="middle"
			fill="var(--text-secondary)" style="font-family:var(--font-mono);font-size:9px;">{d.points}</text>
	{/each}
</svg>
