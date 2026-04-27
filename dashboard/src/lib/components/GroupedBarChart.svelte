<script lang="ts">
	let {
		data,
		height = 180
	}: { data: { label: string; issues: number; points: number }[]; height?: number } = $props();

	let hoveredIdx = $state<number | null>(null);

	let maxI = $derived(Math.max(...data.map((d) => d.issues), 1));
	let maxP = $derived(Math.max(...data.map((d) => d.points), 1));
	let maxVal = $derived(Math.max(maxI, maxP));
	let barW = $derived(Math.max(10, Math.min(22, 480 / Math.max(data.length, 1) * 0.38)));
	let barGap = 4;
	let groupGap = $derived(Math.max(10, Math.min(22, 480 / Math.max(data.length, 1) * 0.24)));
	let groupW = $derived(barW * 2 + barGap);
	let totalW = $derived(data.length * (groupW + groupGap) - groupGap);
	let padY = 28, padX = 10;

	function barH(val: number) {
		return Math.max(2, (val / maxVal) * height);
	}
</script>

<div style="position:relative;width:100%;">
	<svg
		viewBox="0 0 {totalW + padX * 2} {height + padY + 20}"
		style="width:100%;height:{height + padY + 20}px;overflow:visible;"
		role="img"
	>
		<defs>
			<linearGradient id="gg-issues" x1="0" y1="0" x2="0" y2="1">
				<stop offset="0%" stop-color="#f07040" stop-opacity="1"/>
				<stop offset="100%" stop-color="#b53020" stop-opacity="0.5"/>
			</linearGradient>
			<linearGradient id="gg-points" x1="0" y1="0" x2="0" y2="1">
				<stop offset="0%" stop-color="#93c5fd" stop-opacity="0.95"/>
				<stop offset="100%" stop-color="#3b82f6" stop-opacity="0.4"/>
			</linearGradient>
		</defs>

		<!-- Legend -->
		<rect x={padX} y="5" width="9" height="9" fill="url(#gg-issues)" rx="2"/>
		<text x={padX + 13} y="13" fill="var(--text-muted)" style="font-family:var(--font-mono);font-size:9px;">Issues</text>
		<rect x={padX + 52} y="5" width="9" height="9" fill="url(#gg-points)" rx="2"/>
		<text x={padX + 65} y="13" fill="var(--text-muted)" style="font-family:var(--font-mono);font-size:9px;">Points</text>

		<!-- Grid lines -->
		{#each [0.25, 0.5, 0.75, 1] as f, fi}
			<line
				x1={padX} x2={totalW + padX}
				y1={padY + (1 - f) * height} y2={padY + (1 - f) * height}
				stroke="rgba(255,160,100,{fi === 3 ? 0.11 : 0.045})"
				stroke-width="1"
				stroke-dasharray={fi === 3 ? '' : '3 4'}
			/>
		{/each}

		{#each data as d, i}
			{@const gx = padX + i * (groupW + groupGap)}
			{@const ih = barH(d.issues)}
			{@const ph = barH(d.points)}
			{@const isHov = hoveredIdx === i}

			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<g
				onmouseenter={() => (hoveredIdx = i)}
				onmouseleave={() => (hoveredIdx = null)}
				style="cursor:default;"
			>
				<!-- Issues bar glow -->
				<rect
					x={gx} y={padY + height - ih * 0.5}
					width={barW} height={ih * 0.5}
					fill="#f07040" rx="2" opacity={isHov ? 0.22 : 0.08}
					style="filter:blur(5px);transition:opacity 0.15s ease;"
				/>
				<!-- Issues bar -->
				<rect
					x={gx} y={padY + height - ih}
					width={barW} height={ih}
					fill="url(#gg-issues)" rx="3"
					opacity={isHov ? 1 : 0.88}
					style="transition:opacity 0.15s ease;"
				/>
				<!-- Issues bar specular top -->
				<rect x={gx} y={padY + height - ih} width={barW} height="1.5"
					fill="rgba(255,200,140,0.4)" rx="3"/>

				<!-- Points bar glow -->
				<rect
					x={gx + barW + barGap} y={padY + height - ph * 0.5}
					width={barW} height={ph * 0.5}
					fill="#60a5fa" rx="2" opacity={isHov ? 0.22 : 0.08}
					style="filter:blur(5px);transition:opacity 0.15s ease;"
				/>
				<!-- Points bar -->
				<rect
					x={gx + barW + barGap} y={padY + height - ph}
					width={barW} height={ph}
					fill="url(#gg-points)" rx="3"
					opacity={isHov ? 0.95 : 0.8}
					style="transition:opacity 0.15s ease;"
				/>
				<!-- Points bar specular top -->
				<rect x={gx + barW + barGap} y={padY + height - ph} width={barW} height="1.5"
					fill="rgba(180,220,255,0.3)" rx="3"/>

				<!-- Hover value labels -->
				{#if isHov}
					<text x={gx + barW / 2} y={padY + height - ih - 5}
						text-anchor="middle" fill="#f07040"
						style="font-family:var(--font-mono);font-size:10px;font-weight:500;">{d.issues}</text>
					<text x={gx + barW + barGap + barW / 2} y={padY + height - ph - 5}
						text-anchor="middle" fill="#93c5fd"
						style="font-family:var(--font-mono);font-size:10px;font-weight:500;">{d.points}</text>
				{/if}

				<!-- Group label -->
				<text
					x={gx + groupW / 2} y={padY + height + 14}
					text-anchor="middle"
					fill={isHov ? 'var(--text-secondary)' : 'var(--text-muted)'}
					style="font-family:var(--font-mono);font-size:9px;transition:fill 0.15s ease;"
				>{d.label}</text>
			</g>
		{/each}
	</svg>
</div>
