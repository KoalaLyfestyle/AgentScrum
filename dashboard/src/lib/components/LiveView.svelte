<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import IssueKey from './IssueKey.svelte';
	import Badge from './Badge.svelte';
	import Icon from './Icon.svelte';
	import { fmt } from '$lib/utils/fmt.js';

	let {
		data,
		onNavigate,
		onIssueSelect
	}: {
		data: any;
		onNavigate: (p: { view: string; sprint?: number; epic?: number }) => void;
		onIssueSelect: (i: any) => void;
	} = $props();

	let projectId = $derived(data.projectId);
	let activeSprint = $derived(data.sprints.find((s: any) => s.projectId === projectId && s.status === 'active'));
	let allIssues = $derived(activeSprint ? data.issues.filter((i: any) => i.sprintId === activeSprint.id) : []);
	let activeIssues = $derived(allIssues.filter((i: any) => i.status === 'in_progress' || i.status === 'review'));
	let todoIssues = $derived(allIssues.filter((i: any) => i.status === 'todo'));
	let doneIssues = $derived(allIssues.filter((i: any) => i.status === 'done'));
	let totalPts = $derived(allIssues.reduce((s: number, i: any) => s + (i.storyPoints ?? 0), 0));
	let donePts = $derived(doneIssues.reduce((s: number, i: any) => s + (i.storyPoints ?? 0), 0));
	let daysActive = $derived(activeSprint ? Math.floor((Date.now() - new Date(activeSprint.startedAt).getTime()) / 86400000) : 0);

	// Live token state
	let liveTokens = $state<Record<number, number>>({});
	let tickingId = $state<number | null>(null);

	// Event log (sessions sorted most-recent first)
	let eventLog = $state<any[]>([]);

	let intervals: ReturnType<typeof setInterval>[] = [];

	function initState() {
		const tm: Record<number, number> = {};
		allIssues.forEach((i: any) => { tm[i.id] = i.tokensUsed; });
		liveTokens = tm;

		const sprintSessions = data.sessions.filter((s: any) => allIssues.find((i: any) => i.id === s.issueId));
		eventLog = sprintSessions
			.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
			.map((s: any) => ({ ...s, _key: s.id, _new: false }));
	}

	$effect(() => {
		initState();
	});

	const FAKE_SUMMARIES = [
		'Scaffolding SvelteKit layout routes and +page.svelte files.',
		'Reading Drizzle schema to type API response shapes.',
		'Running npm run dev — hot reload working on port 5173.',
		'Writing Zod validators for /api/sprint endpoint.',
		'Checking WAL mode pragma on SQLite connection.',
		'Resolving Vite alias path for $scrum import.',
		'Confirming Playwright smoke test baseline passes.',
	];
	let summaryIdx = 0;

	onMount(() => {
		if (!activeSprint || activeIssues.length === 0) return;

		// Token drip every ~3s
		const iv1 = setInterval(() => {
			if (activeIssues.length === 0) return;
			const target = activeIssues[Math.floor(Math.random() * activeIssues.length)];
			const delta = Math.floor(Math.random() * 480 + 60);
			liveTokens = { ...liveTokens, [target.id]: (liveTokens[target.id] ?? 0) + delta };
			tickingId = target.id;
			setTimeout(() => { tickingId = null; }, 800);
		}, 2800);

		// New session event every ~18s
		const iv2 = setInterval(() => {
			if (activeIssues.length === 0) return;
			const iss = activeIssues[Math.floor(Math.random() * activeIssues.length)];
			const tok = Math.floor(Math.random() * 5000 + 800);
			const newEv = {
				id: Date.now(), issueId: iss.id,
				summary: FAKE_SUMMARIES[summaryIdx % FAKE_SUMMARIES.length],
				tokensUsed: tok, model: iss.assignedTo ?? 'claude-sonnet-4-5',
				createdAt: new Date().toISOString(), auditor: 'pass', _new: true, _key: Date.now()
			};
			summaryIdx++;
			eventLog = [newEv, ...eventLog.slice(0, 19)];
			liveTokens = { ...liveTokens, [iss.id]: (liveTokens[iss.id] ?? 0) + tok };
			tickingId = iss.id;
			setTimeout(() => { tickingId = null; }, 800);
		}, 18000);

		intervals = [iv1, iv2];
	});

	onDestroy(() => {
		intervals.forEach(clearInterval);
	});

	let liveTotal = $derived(Object.values(liveTokens).reduce((s, v) => s + v, 0));

	// Agent distribution
	let agentMap = $derived(() => {
		const agents: Record<string, number> = {};
		allIssues.forEach((i: any) => { if (i.assignedTo) agents[i.assignedTo] = (agents[i.assignedTo] ?? 0) + 1; });
		const sprintSessions = data.sessions.filter((s: any) => allIssues.find((i: any) => i.id === s.issueId));
		const agentTok: Record<string, number> = {};
		sprintSessions.forEach((s: any) => {
			const iss = allIssues.find((i: any) => i.id === s.issueId);
			if (iss?.assignedTo) agentTok[iss.assignedTo] = (agentTok[iss.assignedTo] ?? 0) + s.tokensUsed;
		});
		const keys = Object.keys(agents);
		const maxTok = Math.max(...keys.map((k) => agentTok[k] ?? 0), 1);
		return keys.map((k) => ({ key: k, tok: agentTok[k] ?? 0, pct: ((agentTok[k] ?? 0) / maxTok) * 100 }));
	});

	function epicForIssue(issue: any) {
		return data.epics.find((e: any) => e.id === issue.epicId);
	}
	function acsForIssue(issue: any) {
		return data.acs.filter((a: any) => a.issueId === issue.id);
	}
	function sessionsForIssue(issue: any) {
		return data.sessions.filter((s: any) => s.issueId === issue.id);
	}
</script>

{#if !activeSprint}
	<div class="glass-standard" style="text-align:center;padding:var(--space-12);color:var(--text-muted);font-size:var(--text-sm);">
		No active sprint — start one to see live tracking.
	</div>
{:else}
	<div>
		<!-- Header -->
		<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:var(--space-6);">
			<div>
				<div style="display:flex;align-items:center;gap:var(--space-2);margin-bottom:6px;">
					<span style="width:8px;height:8px;border-radius:50%;background:var(--accent-primary);display:inline-block;animation:liveBlip 1.4s ease-in-out infinite;box-shadow:0 0 10px var(--accent-primary);"></span>
					<span style="font-family:var(--font-display);font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:var(--accent-primary);">Live</span>
					<span style="font-family:var(--font-mono);font-size:10px;color:var(--text-muted);margin-left:4px;">· simulated · Langfuse streaming coming soon</span>
				</div>
				<h2 style="margin:0;">{activeSprint.title}</h2>
				<p style="font-family:var(--font-body);font-size:var(--text-sm);color:var(--text-muted);font-style:italic;margin:4px 0 0;">{activeSprint.goal}</p>
			</div>
			<div style="display:flex;gap:var(--space-3);flex-shrink:0;">
				{#each [['Issues', `${doneIssues.length}/${allIssues.length}`, 'done'], ['Points', `${donePts}/${totalPts}`, 'pts'], ['Day', daysActive, 'of sprint'], ['Agents', activeIssues.filter((i: any) => i.assignedTo).length, 'active']] as [label, val, sub]}
					<div class="glass-standard glass-sm" style="text-align:center;min-width:72px;">
						<div style="font-family:var(--font-display);font-size:9px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:var(--text-muted);margin-bottom:2px;">{label}</div>
						<div style="font-family:var(--font-mono);font-size:var(--text-lg);color:var(--text-primary);line-height:1.1;">{val}</div>
						<div style="font-family:var(--font-mono);font-size:9px;color:var(--text-muted);margin-top:1px;">{sub}</div>
					</div>
				{/each}
			</div>
		</div>

		<!-- Burn strip -->
		<div class="glass-standard" style="padding:var(--space-4) var(--space-5);margin-bottom:var(--space-5);display:flex;align-items:center;gap:var(--space-6);">
			<div style="flex:1;">
				<div style="display:flex;justify-content:space-between;margin-bottom:6px;">
					<span style="font-family:var(--font-display);font-size:10px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-muted);">Sprint Progress</span>
					<span style="font-family:var(--font-mono);font-size:10px;color:var(--text-muted);">{totalPts > 0 ? Math.round((donePts / totalPts) * 100) : 0}%</span>
				</div>
				<div style="height:6px;background:rgba(255,100,60,0.08);border-radius:3px;overflow:hidden;position:relative;">
					<div class="token-shimmer" style="position:absolute;inset:0;opacity:0.06;"></div>
					<div style="height:100%;border-radius:3px;background:linear-gradient(90deg,var(--accent-secondary),var(--accent-primary));width:{totalPts > 0 ? (donePts / totalPts) * 100 : 0}%;box-shadow:0 0 10px var(--accent-glow);transition:width 1s ease;"></div>
				</div>
				<div style="display:flex;justify-content:space-between;margin-top:5px;">
					<span style="font-family:var(--font-mono);font-size:10px;color:var(--status-success);">{donePts} pts done</span>
					<span style="font-family:var(--font-mono);font-size:10px;color:var(--text-muted);">{totalPts - donePts} remaining</span>
				</div>
			</div>
			<div style="width:1px;height:40px;background:var(--border-subtle);"></div>
			<div style="text-align:center;">
				<div style="font-family:var(--font-display);font-size:9px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:var(--text-muted);margin-bottom:2px;">Session Tokens</div>
				<div style="font-family:var(--font-mono);font-size:var(--text-xl);color:var(--accent-ember);transition:all 0.4s ease;">{fmt.tokens(liveTotal)}</div>
			</div>
			<div style="width:1px;height:40px;background:var(--border-subtle);"></div>
			<div style="display:flex;gap:var(--space-4);">
				{#each [['todo', 'To Do', 'var(--text-muted)'], ['in_progress', 'Active', 'var(--accent-primary)'], ['done', 'Done', 'var(--status-success)']] as [st, lb, col]}
					<div style="text-align:center;">
						<div style="font-family:var(--font-mono);font-size:var(--text-xl);color:{col};line-height:1;">{allIssues.filter((i: any) => i.status === st).length}</div>
						<div style="font-family:var(--font-display);font-size:9px;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-muted);margin-top:3px;">{lb}</div>
					</div>
				{/each}
			</div>
		</div>

		<!-- Main grid -->
		<div style="display:grid;grid-template-columns:1fr 340px;gap:var(--space-5);">
			<!-- Left col -->
			<div style="display:flex;flex-direction:column;gap:var(--space-4);">
				{#if activeIssues.length === 0}
					<div class="glass-standard" style="text-align:center;padding:var(--space-10);color:var(--text-muted);font-size:var(--text-sm);">No issues in progress — agents are idle.</div>
				{/if}
				{#each activeIssues as issue}
					{@const epic = epicForIssue(issue)}
					{@const acs = acsForIssue(issue)}
					{@const acDone = acs.filter((a: any) => a.completed).length}
					{@const sessList = sessionsForIssue(issue)}
					{@const tokens = liveTokens[issue.id] ?? issue.tokensUsed}
					{@const isActive = tickingId === issue.id}
					{@const tokenPct = Math.min(100, (tokens / 50000) * 100)}
					<div class="glass-enhanced live-card" style="cursor:pointer;" onclick={() => onIssueSelect(issue)}>
						<div style="position:absolute;inset:0;border-radius:var(--radius-lg);border:1px solid var(--accent-primary);animation:borderPulse 2.6s ease-in-out infinite;pointer-events:none;"></div>

						<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:var(--space-4);margin-bottom:var(--space-4);">
							<div style="flex:1;min-width:0;">
								<div style="display:flex;align-items:center;gap:var(--space-2);margin-bottom:var(--space-2);flex-wrap:wrap;">
									{#if epic}<IssueKey epicNum={epic.number} issueNum={issue.number}/>{/if}
									<Badge status={issue.status}/>
									<Badge type={issue.type}/>
									<Badge priority={issue.priority}/>
								</div>
								<h4 style="margin:0;font-weight:600;font-size:var(--text-base);">{issue.title}</h4>
								<div style="font-family:var(--font-mono);font-size:var(--text-xs);color:var(--accent-ember);margin-top:6px;">{issue.assignedTo ?? 'unassigned'}</div>
							</div>
							<div style="text-align:right;flex-shrink:0;">
								<div style="font-family:var(--font-display);font-size:9px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:var(--text-muted);margin-bottom:2px;">tokens</div>
								<div style="font-family:var(--font-mono);font-size:var(--text-2xl);color:{isActive ? 'var(--accent-primary)' : 'var(--accent-ember)'};line-height:1;transition:color 0.3s ease;animation:{isActive ? 'countUp 0.4s ease' : 'none'};">{fmt.tokens(tokens)}</div>
								<div style="font-family:var(--font-mono);font-size:9px;color:var(--text-muted);margin-top:3px;">{sessList.length} session{sessList.length !== 1 ? 's' : ''} · {issue.storyPoints}pt</div>
							</div>
						</div>

						<!-- Token flow bar -->
						<div style="position:relative;height:6px;background:rgba(255,100,60,0.07);border-radius:3px;margin-bottom:var(--space-4);overflow:hidden;">
							<div style="position:absolute;inset:0;height:100%;border-radius:3px;width:{tokenPct}%;background:linear-gradient(90deg,var(--accent-secondary),var(--accent-primary));box-shadow:0 0 10px var(--accent-glow);transition:width 1.2s ease;"></div>
							{#if isActive}
								<div style="position:absolute;top:0;left:0;height:100%;width:100%;overflow:hidden;">
									{#each [0, 1, 2] as j}
										<div style="position:absolute;top:50%;transform:translateY(-50%);left:{j * 30}%;width:10px;height:3px;border-radius:2px;background:rgba(255,255,255,0.7);animation:flowDot 1.4s ease {j * 0.28}s infinite;"></div>
									{/each}
								</div>
							{/if}
						</div>

						<!-- AC progress -->
						{#if acs.length > 0}
							<div style="margin-bottom:var(--space-4);">
								<div style="display:flex;justify-content:space-between;margin-bottom:var(--space-2);">
									<span style="font-family:var(--font-display);font-size:9px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-muted);">Acceptance Criteria</span>
									<span style="font-family:var(--font-mono);font-size:10px;color:{acDone === acs.length ? 'var(--status-success)' : 'var(--text-muted)'};">{acDone}/{acs.length}</span>
								</div>
								<div style="display:flex;gap:4px;margin-bottom:var(--space-3);">
									{#each acs as ac}
										<div style="flex:1;height:5px;border-radius:2px;background:{ac.completed ? 'var(--status-success)' : 'rgba(255,160,100,0.1)'};transition:background 0.4s;box-shadow:{ac.completed ? '0 0 6px rgba(52,211,153,0.4)' : 'none'};"></div>
									{/each}
								</div>
								<div style="display:flex;flex-direction:column;gap:var(--space-1);">
									{#each acs as ac}
										<div style="display:flex;align-items:center;gap:var(--space-2);">
											<div style="width:10px;height:10px;border-radius:2px;flex-shrink:0;background:{ac.completed ? 'var(--status-success)' : 'transparent'};border:1.5px solid {ac.completed ? 'var(--status-success)' : 'rgba(255,160,100,0.2)'};display:flex;align-items:center;justify-content:center;">
												{#if ac.completed}<Icon name="check" size={7} color="var(--bg-base)"/>{/if}
											</div>
											<span style="font-family:var(--font-body);font-size:var(--text-xs);color:{ac.completed ? 'var(--text-muted)' : 'var(--text-secondary)'};text-decoration:{ac.completed ? 'line-through' : 'none'};">{ac.text}</span>
										</div>
									{/each}
								</div>
							</div>
						{/if}

						<!-- Last session -->
						{#if sessList.length > 0}
							{@const last = sessList[sessList.length - 1]}
							<div style="background:rgba(255,80,40,0.04);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:var(--space-2) var(--space-3);">
								<div style="display:flex;justify-content:space-between;margin-bottom:3px;">
									<span style="font-family:var(--font-display);font-size:9px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-muted);">Last session</span>
									<span style="font-family:var(--font-mono);font-size:9px;color:var(--text-muted);">{fmt.ago(last.createdAt)}</span>
								</div>
								<p style="font-family:var(--font-body);font-size:var(--text-xs);color:var(--text-secondary);margin:0;line-height:1.5;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">{last.summary}</p>
							</div>
						{/if}
					</div>
				{/each}

				<!-- Todo queue -->
				{#if todoIssues.length > 0}
					<div class="glass-standard">
						<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-3);">
							<div class="label-upper" style="font-size:10px;">Queue — Up Next</div>
							<span style="font-family:var(--font-mono);font-size:10px;color:var(--text-muted);">{todoIssues.length} issues</span>
						</div>
						<div style="display:flex;flex-direction:column;gap:var(--space-2);">
							{#each todoIssues as issue, idx}
								{@const epic = epicForIssue(issue)}
								<div style="display:flex;align-items:center;gap:var(--space-3);padding:var(--space-2) var(--space-3);border-radius:var(--radius-sm);background:rgba(255,160,100,0.03);border:1px solid var(--border-subtle);cursor:pointer;opacity:{Math.max(0.45, 1 - idx * 0.12)};"
									onclick={() => onIssueSelect(issue)}>
									<span style="font-family:var(--font-mono);font-size:10px;color:var(--border-strong);width:14px;text-align:center;flex-shrink:0;">{idx + 1}</span>
									{#if epic}<IssueKey epicNum={epic.number} issueNum={issue.number}/>{/if}
									<span style="font-family:var(--font-body);font-size:var(--text-sm);color:var(--text-secondary);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{issue.title}</span>
									<Badge type={issue.type}/>
									<Badge priority={issue.priority}/>
									<span style="font-family:var(--font-mono);font-size:10px;color:var(--text-muted);flex-shrink:0;">{issue.storyPoints}pt</span>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>

			<!-- Right col -->
			<div style="display:flex;flex-direction:column;gap:var(--space-4);">
				<!-- Agent bars -->
				<div class="glass-standard" style="padding:var(--space-4);">
					<div class="label-upper" style="font-size:10px;margin-bottom:var(--space-3);">Agents This Sprint</div>
					{#each agentMap() as ag}
						<div style="margin-bottom:var(--space-3);">
							<div style="display:flex;justify-content:space-between;margin-bottom:5px;">
								<span style="font-family:var(--font-mono);font-size:var(--text-xs);color:var(--accent-ember);">{ag.key.replace('claude-', '')}</span>
								<span style="font-family:var(--font-mono);font-size:10px;color:var(--text-muted);">{fmt.tokens(ag.tok)}</span>
							</div>
							<div style="height:3px;background:rgba(255,100,60,0.08);border-radius:2px;">
								<div style="height:100%;border-radius:2px;background:linear-gradient(90deg,var(--accent-secondary),var(--accent-ember));width:{ag.pct}%;transition:width 1s ease;"></div>
							</div>
						</div>
					{/each}
				</div>

				<!-- Live event feed -->
				<div class="glass-standard" style="flex:1;padding:var(--space-4);">
					<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-4);">
						<div class="label-upper" style="font-size:10px;">Session Log</div>
						<div style="display:flex;align-items:center;gap:6px;">
							<span style="width:6px;height:6px;border-radius:50%;background:var(--status-success);display:inline-block;animation:pulse 2s ease-in-out infinite;box-shadow:0 0 6px var(--status-success);"></span>
							<span style="font-family:var(--font-mono);font-size:10px;color:var(--text-muted);">streaming</span>
						</div>
					</div>
					<div style="display:flex;flex-direction:column;gap:var(--space-1);max-height:520px;overflow-y:auto;padding-right:2px;">
						{#each eventLog as ev, idx (ev._key)}
							{@const iss = allIssues.find((i: any) => i.id === ev.issueId)}
							{@const epic = iss ? epicForIssue(iss) : null}
							<div class="{ev._new ? 'event-enter' : ''}" style="display:flex;gap:var(--space-3);padding:var(--space-2);border-radius:var(--radius-sm);background:{ev._new ? 'rgba(232,64,42,0.06)' : 'transparent'};transition:background 2s ease;position:relative;">
								{#if idx < eventLog.length - 1}
									<div style="position:absolute;left:8px;top:18px;bottom:-4px;width:1px;background:var(--border-subtle);"></div>
								{/if}
								<div style="width:11px;height:11px;border-radius:50%;flex-shrink:0;margin-top:3px;z-index:1;background:{ev._new ? 'var(--accent-primary)' : 'var(--bg-elevated)'};border:1.5px solid {ev._new ? 'var(--accent-primary)' : 'var(--border-default)'};box-shadow:{ev._new ? '0 0 8px var(--accent-glow)' : 'none'};transition:all 0.4s ease;"></div>
								<div style="flex:1;min-width:0;">
									<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px;gap:var(--space-2);">
										<div style="display:flex;align-items:center;gap:var(--space-2);min-width:0;">
											{#if iss && epic}<IssueKey epicNum={epic.number} issueNum={iss.number}/>{/if}
											{#if ev._new}<span style="font-family:var(--font-display);font-size:9px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--accent-primary);">new</span>{/if}
										</div>
										<span style="font-family:var(--font-mono);font-size:9px;color:var(--text-muted);flex-shrink:0;">{fmt.tokens(ev.tokensUsed)}</span>
									</div>
									<p style="font-family:var(--font-body);font-size:var(--text-xs);color:var(--text-secondary);margin:0;line-height:1.5;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">{ev.summary}</p>
									<div style="display:flex;justify-content:space-between;margin-top:3px;">
										<span style="font-family:var(--font-mono);font-size:9px;color:var(--accent-ember);">{ev.model?.replace('claude-', '')}</span>
										<span style="font-family:var(--font-mono);font-size:9px;color:var(--text-muted);">{fmt.ago(ev.createdAt)}</span>
									</div>
								</div>
							</div>
						{/each}
					</div>
				</div>

				<!-- Done issues -->
				{#if doneIssues.length > 0}
					<div class="glass-standard" style="padding:var(--space-4);">
						<div class="label-upper" style="font-size:10px;margin-bottom:var(--space-3);">Completed ({doneIssues.length})</div>
						<div style="display:flex;flex-direction:column;gap:var(--space-2);">
							{#each doneIssues as issue}
								{@const epic = epicForIssue(issue)}
								<div style="display:flex;align-items:center;gap:var(--space-2);cursor:pointer;" onclick={() => onIssueSelect(issue)}>
									<div style="width:10px;height:10px;border-radius:2px;background:var(--status-success);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
										<Icon name="check" size={7} color="var(--bg-base)"/>
									</div>
									{#if epic}<IssueKey epicNum={epic.number} issueNum={issue.number}/>{/if}
									<span style="font-family:var(--font-body);font-size:var(--text-xs);color:var(--text-muted);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-decoration:line-through;">{issue.title}</span>
									<span style="font-family:var(--font-mono);font-size:9px;color:var(--text-muted);flex-shrink:0;">{fmt.tokens(issue.tokensUsed)}</span>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
