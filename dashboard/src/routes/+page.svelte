<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import IssueDetailPanel from '$lib/components/IssueDetailPanel.svelte';
	import OverviewView from '$lib/components/OverviewView.svelte';
	import LiveView from '$lib/components/LiveView.svelte';
	import AllSprintsView from '$lib/components/AllSprintsView.svelte';
	import SprintBoardView from '$lib/components/SprintBoardView.svelte';
	import EpicsView from '$lib/components/EpicsView.svelte';
	import EpicDetailView from '$lib/components/EpicDetailView.svelte';
	import IssuesView from '$lib/components/IssuesView.svelte';
	import VelocityView from '$lib/components/VelocityView.svelte';
	import TokensView from '$lib/components/TokensView.svelte';
	import DecisionsView from '$lib/components/DecisionsView.svelte';
	import LessonsView from '$lib/components/LessonsView.svelte';

	let { data } = $props();

	// Derive nav state from URL params
	let view = $derived($page.url.searchParams.get('view') ?? 'overview');
	let sprintId = $derived(Number($page.url.searchParams.get('sprint') ?? '0'));
	let epicId = $derived(Number($page.url.searchParams.get('epic') ?? '0'));
	let navMode = $derived($page.url.searchParams.get('nav') ?? 'sidebar');
	let embedded = $derived(navMode === 'none');

	let selectedIssue = $state<typeof data.issues[0] | null>(null);

	function navigate(params: { view: string; sprint?: number; epic?: number }) {
		const u = new URL($page.url);
		u.searchParams.set('view', params.view);
		if (params.sprint) u.searchParams.set('sprint', String(params.sprint));
		else u.searchParams.delete('sprint');
		if (params.epic) u.searchParams.set('epic', String(params.epic));
		else u.searchParams.delete('epic');
		selectedIssue = null;
		goto(u.toString(), { replaceState: true });
	}

	function setProject(id: number) {
		const u = new URL($page.url);
		u.searchParams.set('project', String(id));
		u.searchParams.set('view', 'overview');
		u.searchParams.delete('sprint');
		u.searchParams.delete('epic');
		selectedIssue = null;
		goto(u.toString());
	}

	// Breadcrumb label
	let breadcrumb = $derived(() => {
		if (view === 'sprint') {
			return data.sprints.find((s) => s.id === sprintId)?.title ?? 'Sprint';
		}
		if (view === 'epic') {
			return data.epics.find((e) => e.id === epicId)?.title ?? 'Epic';
		}
		return view;
	});

	// Active issues count for topbar indicator
	let activeSprint = $derived(data.sprints.find((s) => s.projectId === data.projectId && s.status === 'active'));
	let sprintIssues = $derived(activeSprint ? data.issues.filter((i) => i.sprintId === activeSprint!.id) : []);
	let inProgressCount = $derived(sprintIssues.filter((i) => i.status === 'in_progress').length);
</script>

<div class="app-bg" style="display:flex;min-height:100vh;">
	{#if !embedded}
		<Sidebar
			projects={data.projects}
			projectId={data.projectId}
			{view}
			{sprintId}
			{epicId}
			sprints={data.sprints}
			epics={data.epics}
			onNavigate={navigate}
			onProjectChange={setProject}
		/>
	{/if}

	<div style="flex:1;margin-left:{embedded ? 0 : 'var(--sidebar-width)'};min-height:100vh;display:flex;flex-direction:column;position:relative;z-index:2;">
		{#if !embedded}
			<!-- Topbar breadcrumb + live indicator -->
			<div style="position:sticky;top:0;z-index:50;background:rgba(6,8,10,0.88);backdrop-filter:blur(16px);border-bottom:1px solid var(--border-subtle);padding:0 var(--space-8);height:50px;display:flex;align-items:center;justify-content:space-between;">
				<div style="display:flex;align-items:center;gap:var(--space-2);font-family:var(--font-mono);font-size:var(--text-xs);color:var(--text-muted);">
					<span style="color:var(--text-secondary);">{data.projects.find((p) => p.id === data.projectId)?.name}</span>
					<span>›</span>
					<span style="color:var(--text-primary);text-transform:capitalize;">{breadcrumb()}</span>
				</div>
				<div style="display:flex;align-items:center;gap:var(--space-3);">
					<div style="display:flex;align-items:center;gap:var(--space-2);">
						<div style="width:7px;height:7px;border-radius:50%;background:var(--accent-primary);box-shadow:0 0 8px var(--accent-glow-strong);animation:pulse 2s ease-in-out infinite;"></div>
						<span style="font-family:var(--font-mono);font-size:var(--text-xs);color:var(--text-muted);">{inProgressCount} in progress</span>
					</div>
				</div>
			</div>
		{/if}

		<div style="flex:1;padding:var(--space-8);max-width:1100px;width:100%;margin:0 auto;">
			{#if view === 'overview'}
				<OverviewView {data} onNavigate={navigate} onIssueSelect={(i) => (selectedIssue = i)} />
			{:else if view === 'live'}
				<LiveView {data} onNavigate={navigate} onIssueSelect={(i) => (selectedIssue = i)} />
			{:else if view === 'sprints'}
				<AllSprintsView {data} onNavigate={navigate} />
			{:else if view === 'sprint'}
				<SprintBoardView {data} {sprintId} onNavigate={navigate} onIssueSelect={(i) => (selectedIssue = i)} />
			{:else if view === 'epics'}
				<EpicsView {data} onNavigate={navigate} />
			{:else if view === 'epic'}
				<EpicDetailView {data} {epicId} onNavigate={navigate} onIssueSelect={(i) => (selectedIssue = i)} />
			{:else if view === 'issues'}
				<IssuesView {data} onIssueSelect={(i) => (selectedIssue = i)} />
			{:else if view === 'velocity'}
				<VelocityView {data} />
			{:else if view === 'tokens'}
				<TokensView {data} onIssueSelect={(i) => (selectedIssue = i)} />
			{:else if view === 'decisions'}
				<DecisionsView {data} />
			{:else if view === 'lessons'}
				<LessonsView {data} />
			{:else}
				<OverviewView {data} onNavigate={navigate} onIssueSelect={(i) => (selectedIssue = i)} />
			{/if}
		</div>
	</div>

	{#if selectedIssue}
		<IssueDetailPanel
			issue={selectedIssue}
			acs={data.acs.filter((a) => a.issueId === selectedIssue!.id)}
			sessions={data.sessions.filter((s) => s.issueId === selectedIssue!.id)}
			epics={data.epics}
			sprints={data.sprints}
			onClose={() => (selectedIssue = null)}
		/>
	{/if}
</div>
