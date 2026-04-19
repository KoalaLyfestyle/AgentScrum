<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import SprintBoard from '$lib/components/SprintBoard.svelte';
	import VelocityTab from '$lib/components/VelocityTab.svelte';
	import TokenUsage from '$lib/components/TokenUsage.svelte';

	let { data } = $props();

	const tabs = ['board', 'velocity', 'tokens'] as const;
	type Tab = (typeof tabs)[number];

	let projectId = $derived(Number($page.url.searchParams.get('project') ?? '1'));
	let navMode = $derived($page.url.searchParams.get('nav') ?? 'topbar');
	let activeTab = $derived(($page.url.hash.replace('#', '') as Tab) || 'board');

	function switchTab(tab: Tab) {
		const u = new URL($page.url);
		u.hash = tab;
		goto(u.toString(), { replaceState: true });
	}

	function setProject(id: number) {
		const u = new URL($page.url);
		u.searchParams.set('project', String(id));
		goto(u.toString());
	}
</script>

<div class="min-h-screen bg-[#06080a] text-white font-['DM_Sans',sans-serif]">
	{#if navMode !== 'none'}
		<header class="border-b border-white/10 px-6 py-4 flex items-center justify-between">
			<div class="flex items-center gap-6">
				<span class="font-['Syne',sans-serif] font-bold text-lg text-[#e8402a]">AgentScrum</span>
				<nav class="flex gap-1">
					{#each tabs as tab}
						<button
							onclick={() => switchTab(tab)}
							class="px-4 py-1.5 rounded text-sm capitalize transition-colors
								{activeTab === tab
								? 'bg-[#e8402a]/20 text-[#e8402a]'
								: 'text-white/50 hover:text-white'}"
						>
							{tab === 'board' ? 'Sprint Board' : tab === 'velocity' ? 'Velocity' : 'Token Usage'}
						</button>
					{/each}
				</nav>
			</div>
			<div>
				<select
					value={projectId}
					onchange={(e) => setProject(Number((e.target as HTMLSelectElement).value))}
					class="bg-white/5 border border-white/10 rounded px-3 py-1.5 text-sm text-white"
				>
					{#each data.projects as project}
						<option value={project.id}>{project.name}</option>
					{/each}
				</select>
			</div>
		</header>
	{/if}

	<main class="p-6 max-w-7xl mx-auto">
		<div class="app-bg"></div>
		{#if activeTab === 'board'}
			<div id="board-tab">
				{#if data.sprint}
					<SprintBoard data={data.sprint} />
				{:else}
					<p class="text-[#a08880] text-sm">No active sprint found.</p>
				{/if}
			</div>
		{:else if activeTab === 'velocity'}
			<div id="velocity-tab">
				<VelocityTab data={data.velocity} />
			</div>
		{:else if activeTab === 'tokens'}
			<div id="tokens-tab">
				<TokenUsage costs={data.costs} retro={data.retro} velocity={data.velocity} />
			</div>
		{/if}
	</main>
</div>
