<script lang="ts">
	let {
		data,
		valueKey = 'value',
		labelKey = 'label',
		color = 'var(--data-1)',
		height = 160,
		slantLabels = false,
		showArea = false
	}: {
		data: Record<string, any>[];
		valueKey?: string;
		labelKey?: string;
		color?: string;
		height?: number;
		slantLabels?: boolean;
		showArea?: boolean;
	} = $props();

	let hoveredIdx = $state<number | null>(null);

	let maxVal = $derived(Math.max(...data.map((d) => d[valueKey]), 1));
	let barW = $derived(Math.max(14, Math.min(40, 520 / Math.max(data.length, 1) - 10)));
	let gap = $derived(Math.max(6, Math.min(14, 520 / Math.max(data.length, 1) * 0.28)));
	let totalW = $derived(data.length * (barW + gap) - gap);
	let padY = 24, padX = 10;
	let labelH = $derived(slantLabels ? 44 : 20);

	// Compute smooth area path when showArea=true
	let areaPath = $derived(() => {
		if (!showArea || data.length < 2) return '';
		const pts = data.map((d, i) => ({
			x: padX + i * (barW + gap) + barW / 2,
			y: padY + height - Math.max(2, (d[valueKey] / maxVal) * height)
		}));
		// Catmull-Rom to bezier
		let d = `M ${pts[0].x} ${pts[0].y}`;
		for (let i = 0; i < pts.length - 1; i++) {
			const p0 = pts[Math.max(0, i - 1)];
			const p1 = pts[i];
			const p2 = pts[i + 1];
			const p3 = pts[Math.min(pts.length - 1, i + 2)];
			const cp1x = p1.x + (p2.x - p0.x) / 6;
			const cp1y = p1.y + (p2.y - p0.y) / 6;
			const cp2x = p2.x - (p3.x - p1.x) / 6;
			const cp2y = p2.y - (p3.y - p1.y) / 6;
			d += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2.x} ${p2.y}`;
		}
		const baseline = padY + height;
		d += ` L ${pts[pts.length - 1].x} ${baseline} L ${pts[0].x} ${baseline} Z`;
		return d;
	});

	let linePath = $derived(() => {
		if (!showArea || data.length < 2) return '';
		const pts = data.map((d, i) => ({
			x: padX + i * (barW + gap) + barW / 2,
			y: padY + height - Math.max(2, (d[valueKey] / maxVal) * height)
		}));
		let d = `M ${pts[0].x} ${pts[0].y}`;
		for (let i = 0; i < pts.length - 1; i++) {
			const p0 = pts[Math.max(0, i - 1)];
			const p1 = pts[i];
			const p2 = pts[i + 1];
			const p3 = pts[Math.min(pts.length - 1, i + 2)];
			const cp1x = p1.x + (p2.x - p0.x) / 6;
			const cp1y = p1.y + (p2.y - p0.y) / 6;
			const cp2x = p2.x - (p3.x - p1.x) / 6;
			const cp2y = p2.y - (p3.y - p1.y) / 6;
			d += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2.x} ${p2.y}`;
		}
		return d;
	});
</script>

<div style="position:relative;width:100%;">
	<svg
		viewBox="0 0 {totalW + padX * 2} {height + padY + labelH}"
		style="width:100%;height:{height + padY + labelH}px;overflow:visible;"
		role="img"
	>
		<defs>
			<linearGradient id="bar-grad-{color.replace(/[^a-z0-9]/gi,'')}" x1="0" y1="0" x2="0" y2="1">
				<stop offset="0%" stop-color="var(--accent-ember)" stop-opacity="0.95"/>
				<stop offset="100%" stop-color="var(--accent-secondary)" stop-opacity="0.55"/>
			</linearGradient>
			<linearGradient id="area-grad" x1="0" y1="0" x2="0" y2="1">
				<stop offset="0%" stop-color="var(--accent-primary)" stop-opacity="0.28"/>
				<stop offset="100%" stop-color="var(--accent-primary)" stop-opacity="0.02"/>
			</linearGradient>
			<filter id="bar-glow">
				<feGaussianBlur stdDeviation="2.5" result="blur"/>
				<feComposite in="SourceGraphic" in2="blur" operator="over"/>
			</filter>
		</defs>

		<!-- Horizontal grid lines -->
		{#each [0.25, 0.5, 0.75, 1] as f, fi}
			<line
				x1={padX} x2={totalW + padX}
				y1={padY + (1 - f) * height} y2={padY + (1 - f) * height}
				stroke="rgba(255,160,100,{fi === 3 ? 0.12 : 0.05})"
				stroke-width="1"
				stroke-dasharray={fi === 3 ? '' : '3 4'}
			/>
		{/each}

		{#if showArea && data.length >= 2}
			<!-- Smooth area fill -->
			<path d={areaPath()} fill="url(#area-grad)"/>
			<!-- Line -->
			<path d={linePath()} fill="none" stroke="var(--accent-primary)" stroke-width="1.5" opacity="0.7"/>
			<!-- Data points -->
			{#each data as d, i}
				{@const cx = padX + i * (barW + gap) + barW / 2}
				{@const cy = padY + height - Math.max(2, (d[valueKey] / maxVal) * height)}
				<!-- ignore svelte-ignore -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<g
					onmouseenter={() => (hoveredIdx = i)}
					onmouseleave={() => (hoveredIdx = null)}
					style="cursor:default;"
				>
					<circle {cx} {cy} r="8" fill="transparent"/>
					<circle {cx} {cy} r={hoveredIdx === i ? 4 : 2.5}
						fill={hoveredIdx === i ? 'var(--accent-ember)' : 'var(--accent-primary)'}
						stroke="rgba(22,10,8,0.6)" stroke-width="1.5"
						style="transition:r 0.15s ease;filter:drop-shadow(0 0 4px var(--accent-glow-strong));"/>
				</g>
			{/each}
		{:else}
			<!-- Bar chart mode -->
			{#each data as d, i}
				{@const x = padX + i * (barW + gap)}
				{@const barH = Math.max(2, (d[valueKey] / maxVal) * height)}
				{@const y = padY + height - barH}
				{@const isHov = hoveredIdx === i}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<g
					onmouseenter={() => (hoveredIdx = i)}
					onmouseleave={() => (hoveredIdx = null)}
					style="cursor:default;"
				>
					<!-- Glow layer -->
					<rect
						{x} y={y + barH * 0.4} width={barW} height={barH * 0.6}
						fill="var(--accent-primary)"
						rx="2"
						opacity={isHov ? 0.18 : 0.08}
						style="filter:blur(6px);transition:opacity 0.15s ease;"
					/>
					<!-- Main bar -->
					<rect
						{x} {y} width={barW} height={barH}
						fill="url(#bar-grad-{color.replace(/[^a-z0-9]/gi,'')})"
						rx="3"
						opacity={isHov ? 1 : 0.88}
						style="transition:opacity 0.15s ease;"
					/>
					<!-- Top specular edge -->
					<rect
						{x} {y} width={barW} height="2"
						fill="rgba(255,200,140,0.35)"
						rx="3"
					/>
					<!-- Value label on hover -->
					{#if isHov}
						<text
							x={x + barW / 2} y={y - 6}
							text-anchor="middle"
							fill="var(--text-primary)"
							style="font-family:var(--font-mono);font-size:10px;font-weight:500;"
						>{d[valueKey]}</text>
					{/if}
				</g>
			{/each}
		{/if}

		<!-- X-axis labels -->
		{#each data as d, i}
			{@const cx = padX + i * (barW + gap) + barW / 2}
			<text
				x={cx} y={padY + height + 14}
				text-anchor="middle"
				fill={hoveredIdx === i ? 'var(--text-secondary)' : 'var(--text-muted)'}
				style="font-family:var(--font-mono);font-size:9px;transition:fill 0.15s ease;"
				transform={slantLabels ? `rotate(-35,${cx},${padY + height + 14})` : ''}
			>{d[labelKey]}</text>
		{/each}

		<!-- Tooltip box on hover -->
		{#if hoveredIdx !== null && showArea}
			{@const d = data[hoveredIdx]}
			{@const cx = padX + hoveredIdx * (barW + gap) + barW / 2}
			{@const cy = padY + height - Math.max(2, (d[valueKey] / maxVal) * height)}
			{@const ttX = Math.min(cx + 8, totalW + padX - 60)}
			<rect x={ttX} y={cy - 22} width="52" height="18" rx="4"
				fill="rgba(22,10,8,0.88)" stroke="rgba(255,160,100,0.15)" stroke-width="1"/>
			<text x={ttX + 26} y={cy - 10} text-anchor="middle"
				fill="var(--text-primary)" style="font-family:var(--font-mono);font-size:10px;">{d[valueKey]}</text>
		{/if}
	</svg>
</div>
