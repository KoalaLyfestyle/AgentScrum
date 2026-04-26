<script lang="ts">
	import Icon from './Icon.svelte';

	let {
		projects,
		projectId,
		view,
		sprintId,
		epicId,
		sprints,
		epics,
		onNavigate,
		onProjectChange
	}: {
		projects: { id: number; name: string }[];
		projectId: number;
		view: string;
		sprintId: number;
		epicId: number;
		sprints: any[];
		epics: any[];
		onNavigate: (p: { view: string; sprint?: number; epic?: number }) => void;
		onProjectChange: (id: number) => void;
	} = $props();

	let projectDropOpen = $state(false);
	let analyticsOpen = $state(true);
	let sprintsOpen = $state(true);
	let epicsOpen = $state(true);
	let issuesOpen = $state(false);
	let recordsOpen = $state(false);

	let currentProject = $derived(projects.find((p) => p.id === projectId));
	let projectSprints = $derived(
		sprints.filter((s) => s.projectId === projectId).sort((a: any, b: any) => b.number - a.number).slice(0, 5)
	);
	let projectEpics = $derived(epics.filter((e) => e.projectId === projectId));

	function isActive(v: string, sid?: number, eid?: number): boolean {
		if (view !== v) return false;
		if (sid !== undefined && sprintId !== sid) return false;
		if (eid !== undefined && epicId !== eid) return false;
		return true;
	}

	function statusDotColor(status: string): string {
		if (status === 'active' || status === 'in_progress') return 'var(--accent-primary)';
		if (status === 'closed' || status === 'done' || status === 'complete') return 'var(--status-success)';
		if (status === 'planning') return 'var(--text-muted)';
		return 'var(--status-warning)';
	}

	function closeDropdown(e: MouseEvent) {
		projectDropOpen = false;
	}
</script>

<svelte:window onclick={(e) => { if (projectDropOpen) projectDropOpen = false; }} />

<div class="sidebar">
	<!-- Logo -->
	<div class="sidebar-logo">Agent<span>Scrum</span></div>

	<!-- Project dropdown -->
	<div style="position:relative;margin-bottom:var(--space-2);">
		<div onclick={(e) => { e.stopPropagation(); projectDropOpen = !projectDropOpen; }}
			style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--bg-elevated);border:1px solid {projectDropOpen ? 'var(--accent-dim)' : 'var(--border-default)'};border-radius:var(--radius-md);cursor:pointer;transition:border-color var(--t-fast);">
			<div style="display:flex;align-items:center;gap:var(--space-2);">
				<div style="width:6px;height:6px;border-radius:50%;background:var(--accent-primary);box-shadow:0 0 6px var(--accent-glow-strong);"></div>
				<span style="font-family:var(--font-display);font-size:var(--text-sm);font-weight:600;color:var(--text-primary);">{currentProject?.name}</span>
			</div>
			<span class="sidebar-chevron {projectDropOpen ? 'open' : ''}">
				<Icon name="chevronD" size={12} color="var(--text-muted)"/>
			</span>
		</div>
		{#if projectDropOpen}
			<div style="position:absolute;top:calc(100% + 4px);left:0;right:0;z-index:var(--z-overlay);animation:fadeIn 0.15s ease;background:rgba(14,10,8,0.98);border:1px solid var(--border-strong);border-radius:var(--radius-md);box-shadow:0 12px 32px rgba(0,0,0,0.6);backdrop-filter:blur(20px);overflow:hidden;">
				{#each projects as p}
					<div onclick={(e) => { e.stopPropagation(); onProjectChange(p.id); projectDropOpen = false; }}
						style="display:flex;align-items:center;gap:var(--space-2);padding:10px 14px;cursor:pointer;transition:background var(--t-fast);background:{p.id === projectId ? 'var(--accent-glow)' : 'transparent'};border-bottom:1px solid var(--border-subtle);">
						<div style="width:6px;height:6px;border-radius:50%;background:var(--accent-primary);flex-shrink:0;"></div>
						<span style="font-family:var(--font-display);font-size:var(--text-sm);font-weight:{p.id === projectId ? 600 : 400};color:{p.id === projectId ? 'var(--accent-primary)' : 'var(--text-primary)'};">{p.name}</span>
						{#if p.id === projectId}
							<span style="margin-left:auto;font-family:var(--font-mono);font-size:10px;color:var(--accent-primary);">✓</span>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Top-level nav -->
	<div class="nav-item {isActive('overview') ? 'active' : ''}" onclick={() => onNavigate({ view: 'overview' })}>
		<Icon name="home" size={13}/><span>Overview</span>
	</div>
	<div class="nav-item {isActive('live') ? 'active' : ''}" onclick={() => onNavigate({ view: 'live' })}>
		<Icon name="live" size={13}/><span>Live</span>
	</div>

	<!-- Analytics -->
	<div class="sidebar-section">
		<div class="sidebar-section-hdr" onclick={() => (analyticsOpen = !analyticsOpen)}>
			<span class="sidebar-section-label">Analytics</span>
			<span class="sidebar-chevron {analyticsOpen ? 'open' : ''}"><Icon name="chevron" size={11} color="var(--text-muted)"/></span>
		</div>
		{#if analyticsOpen}
			<div style="animation:fadeIn 0.15s ease;">
				<div class="nav-item {isActive('velocity') ? 'active' : ''}" onclick={() => onNavigate({ view: 'velocity' })}>
					<Icon name="velocity" size={13}/><span>Velocity</span>
				</div>
				<div class="nav-item {isActive('tokens') ? 'active' : ''}" onclick={() => onNavigate({ view: 'tokens' })}>
					<Icon name="tokens" size={13}/><span>Token Usage</span>
				</div>
			</div>
		{/if}
	</div>

	<!-- Sprints -->
	<div class="sidebar-section">
		<div class="sidebar-section-hdr" onclick={() => (sprintsOpen = !sprintsOpen)}>
			<span class="sidebar-section-label">Sprints</span>
			<span class="sidebar-chevron {sprintsOpen ? 'open' : ''}"><Icon name="chevron" size={11} color="var(--text-muted)"/></span>
		</div>
		{#if sprintsOpen}
			<div style="animation:fadeIn 0.15s ease;">
				<div class="nav-item {isActive('sprints') ? 'active' : ''}" onclick={() => onNavigate({ view: 'sprints' })}>
					<Icon name="epics" size={13}/><span>All Sprints</span>
				</div>
				{#each projectSprints as s}
					<div class="nav-item sub {isActive('sprint', s.id) ? 'active' : ''}" onclick={() => onNavigate({ view: 'sprint', sprint: s.id })}>
						<span style="font-family:var(--font-mono);font-size:10px;color:{isActive('sprint', s.id) ? 'inherit' : 'var(--accent-ember)'};flex-shrink:0;font-weight:500;">
							S{String(s.number).padStart(2, '0')}
						</span>
						<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
							{(s.title ?? `Sprint ${s.number}`).replace(/Sprint \d+ — /, '')}
						</span>
						<span style="width:6px;height:6px;border-radius:50%;flex-shrink:0;background:{statusDotColor(s.status)};{s.status === 'active' ? `box-shadow:0 0 6px ${statusDotColor(s.status)}` : ''}"></span>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Epics -->
	<div class="sidebar-section">
		<div class="sidebar-section-hdr" onclick={() => (epicsOpen = !epicsOpen)}>
			<span class="sidebar-section-label">Epics</span>
			<span class="sidebar-chevron {epicsOpen ? 'open' : ''}"><Icon name="chevron" size={11} color="var(--text-muted)"/></span>
		</div>
		{#if epicsOpen}
			<div style="animation:fadeIn 0.15s ease;">
				<div class="nav-item {isActive('epics') ? 'active' : ''}" onclick={() => onNavigate({ view: 'epics' })}>
					<Icon name="epics" size={13}/><span>All Epics</span>
				</div>
				{#each projectEpics as epic}
					<div class="nav-item sub {isActive('epic', undefined, epic.id) ? 'active' : ''}" onclick={() => onNavigate({ view: 'epic', epic: epic.id })}>
						<span style="font-family:var(--font-mono);font-size:10px;color:{isActive('epic', undefined, epic.id) ? 'inherit' : 'var(--accent-ember)'};flex-shrink:0;font-weight:500;">
							E{String(epic.number).padStart(2, '0')}
						</span>
						<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{epic.title}</span>
						<span style="width:6px;height:6px;border-radius:50%;flex-shrink:0;background:{statusDotColor(epic.status)};"></span>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Issues -->
	<div class="sidebar-section">
		<div class="sidebar-section-hdr" onclick={() => (issuesOpen = !issuesOpen)}>
			<span class="sidebar-section-label">Issues</span>
			<span class="sidebar-chevron {issuesOpen ? 'open' : ''}"><Icon name="chevron" size={11} color="var(--text-muted)"/></span>
		</div>
		{#if issuesOpen}
			<div style="animation:fadeIn 0.15s ease;">
				<div class="nav-item {isActive('issues') ? 'active' : ''}" onclick={() => onNavigate({ view: 'issues' })}>
					<Icon name="backlog" size={13}/><span>All Issues</span>
				</div>
			</div>
		{/if}
	</div>

	<!-- Records -->
	<div class="sidebar-section">
		<div class="sidebar-section-hdr" onclick={() => (recordsOpen = !recordsOpen)}>
			<span class="sidebar-section-label">Records</span>
			<span class="sidebar-chevron {recordsOpen ? 'open' : ''}"><Icon name="chevron" size={11} color="var(--text-muted)"/></span>
		</div>
		{#if recordsOpen}
			<div style="animation:fadeIn 0.15s ease;">
				<div class="nav-item {isActive('decisions') ? 'active' : ''}" onclick={() => onNavigate({ view: 'decisions' })}>
					<Icon name="decision" size={13}/><span>Decisions</span>
				</div>
				<div class="nav-item {isActive('lessons') ? 'active' : ''}" onclick={() => onNavigate({ view: 'lessons' })}>
					<Icon name="lesson" size={13}/><span>Lessons</span>
				</div>
			</div>
		{/if}
	</div>

	<!-- Footer -->
	<div style="margin-top:auto;padding-top:var(--space-4);border-top:1px solid var(--border-subtle);">
		<div style="font-family:var(--font-mono);font-size:9px;color:var(--text-muted);line-height:1.8;padding:0 var(--space-3);">
			<div>Embed: <code style="background:rgba(255,160,100,0.08);padding:1px 4px;border-radius:3px;font-size:9px;">?nav=none</code></div>
			<div>Read-only · AgentScrum</div>
		</div>
	</div>
</div>
