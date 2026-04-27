<script lang="ts">
	const PATHS: Record<string, string> = {
		home:     'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10',
		live:     'M22 12h-4l-3 9L9 3l-3 9H2',
		list:     'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
		bolt:     'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
		epics:    'M4 6h16M4 10h16M4 14h10',
		backlog:  'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
		velocity: 'M22 12h-4l-3 9L9 3l-3 9H2',
		tokens:   'M12 2a10 10 0 110 20A10 10 0 0112 2zm0 6v4l3 2',
		decision: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
		lesson:   'M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z',
		close:    'M18 6L6 18M6 6l12 12',
		check:    'M20 6L9 17l-5-5',
		chevron:  'M9 18l6-6-6-6',
		chevronD: 'M6 9l6 6 6-6',
		search:   'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
		sort:     'M3 4h18M7 8h10M11 12h6M15 16h2',
		filter:   'M22 3H2l8 9.46V19l4 2v-8.54L22 3z',
	};

	let { name, size = 14, color = 'currentColor' }: { name: string; size?: number; color?: string } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill="none"
	stroke={color} stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
	style="flex-shrink:0;">
	{#if PATHS[name]}
		<path d={PATHS[name]} />
	{/if}
</svg>
