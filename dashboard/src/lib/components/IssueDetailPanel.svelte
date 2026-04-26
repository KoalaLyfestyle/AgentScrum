<script lang="ts">
	import Icon from './Icon.svelte';
	import Badge from './Badge.svelte';
	import IssueKey from './IssueKey.svelte';
	import { fmt } from '$lib/utils/fmt.js';

	let {
		issue,
		acs,
		sessions,
		epics,
		sprints,
		onClose
	}: {
		issue: any;
		acs: any[];
		sessions: any[];
		epics: any[];
		sprints: any[];
		onClose: () => void;
	} = $props();

	let epic = $derived(epics.find((e: any) => e.id === issue.epicId));
	let sprint = $derived(sprints.find((s: any) => s.id === issue.sprintId));
	let acDone = $derived(acs.filter((a: any) => a.completed).length);

	let metaItems = $derived([
		['Sprint', sprint?.title ?? '—'],
		['Epic', epic?.title ?? '—'],
		['Assigned', issue.assignedTo ?? 'Unassigned'],
		['Points', issue.storyPoints ?? '—'],
		['Tokens', fmt.tokens(issue.tokensUsed)],
		['Created', fmt.date(issue.createdAt)],
		...(issue.startedAt ? [['Started', fmt.date(issue.startedAt)]] : []),
		...(issue.completedAt ? [['Done', fmt.date(issue.completedAt)]] : []),
	] as [string, string | number][]);
</script>

<!-- Backdrop -->
<div style="position:fixed;inset:0;z-index:var(--z-modal);display:flex;justify-content:flex-end;"
	onclick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
	<div style="position:absolute;inset:0;background:rgba(6,8,10,0.6);backdrop-filter:blur(4px);"></div>

	<!-- Panel -->
	<div class="glass-liquid" style="position:relative;width:440px;height:100vh;border-radius:0;border-left:1px solid var(--border-strong);display:flex;flex-direction:column;overflow-y:auto;z-index:1;animation:slideIn 0.28s cubic-bezier(0.16,1,0.3,1);">
		<!-- Header -->
		<div style="padding:var(--space-5) var(--space-6);border-bottom:1px solid var(--border-subtle);position:sticky;top:0;background:rgba(6,8,10,0.88);backdrop-filter:blur(16px);z-index:2;">
			<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:var(--space-3);">
				<div style="flex:1;">
					<div style="display:flex;align-items:center;gap:var(--space-2);margin-bottom:var(--space-2);flex-wrap:wrap;">
						{#if epic}
							<IssueKey epicNum={epic.number} issueNum={issue.number}/>
						{/if}
						<Badge status={issue.status}/>
						<Badge type={issue.type}/>
						<Badge priority={issue.priority}/>
					</div>
					<h3 style="font-size:var(--text-base);font-weight:600;line-height:1.4;">{issue.title}</h3>
				</div>
				<button class="btn-icon" onclick={onClose}><Icon name="close" size={14}/></button>
			</div>
		</div>

		<div style="padding:var(--space-5) var(--space-6);display:flex;flex-direction:column;gap:var(--space-5);">
			<!-- Meta grid -->
			<div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3);">
				{#each metaItems as [k, v]}
					<div>
						<div style="font-family:var(--font-display);font-size:10px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-muted);margin-bottom:3px;">{k}</div>
						<div style="font-family:var(--font-mono);font-size:var(--text-sm);color:var(--text-secondary);">{v}</div>
					</div>
				{/each}
			</div>

			<!-- Blocker -->
			{#if issue.blockerReason}
				<div style="background:rgba(251,146,60,0.08);border:1px solid rgba(251,146,60,0.2);border-radius:var(--radius-md);padding:var(--space-3) var(--space-4);">
					<div style="font-family:var(--font-display);font-size:10px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:var(--status-error);margin-bottom:4px;">Blocker</div>
					<p style="font-size:var(--text-sm);margin:0;">{issue.blockerReason}</p>
				</div>
			{/if}

			<!-- Acceptance Criteria -->
			{#if acs.length > 0}
				<div>
					<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-3);">
						<div class="label-upper" style="font-size:10px;">Acceptance Criteria</div>
						<span style="font-family:var(--font-mono);font-size:var(--text-xs);color:var(--text-muted);">{acDone}/{acs.length}</span>
					</div>
					<div style="display:flex;flex-direction:column;gap:var(--space-2);">
						{#each acs as ac}
							<div style="display:flex;align-items:flex-start;gap:var(--space-3);padding:var(--space-2) var(--space-3);border-radius:var(--radius-sm);background:{ac.completed ? 'rgba(52,211,153,0.06)' : 'rgba(255,160,100,0.04)'};border:1px solid {ac.completed ? 'rgba(52,211,153,0.15)' : 'var(--border-subtle)'};">
								<div style="width:14px;height:14px;border-radius:3px;flex-shrink:0;margin-top:2px;background:{ac.completed ? 'var(--status-success)' : 'transparent'};border:1.5px solid {ac.completed ? 'var(--status-success)' : 'var(--border-strong)'};display:flex;align-items:center;justify-content:center;">
									{#if ac.completed}<Icon name="check" size={9} color="var(--bg-base)"/>{/if}
								</div>
								<span style="font-family:var(--font-body);font-size:var(--text-sm);color:{ac.completed ? 'var(--text-muted)' : 'var(--text-secondary)'};text-decoration:{ac.completed ? 'line-through' : 'none'};">{ac.text}</span>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Sessions -->
			{#if sessions.length > 0}
				<div>
					<div class="label-upper" style="font-size:10px;margin-bottom:var(--space-3);">Sessions ({sessions.length})</div>
					<div style="display:flex;flex-direction:column;gap:var(--space-2);">
						{#each sessions as s}
							<div class="glass-standard glass-sm" style="padding:var(--space-3) var(--space-4);">
								<div style="display:flex;justify-content:space-between;margin-bottom:4px;">
									<span style="font-family:var(--font-mono);font-size:var(--text-xs);color:var(--accent-ember);">{s.model}</span>
									<div style="display:flex;gap:var(--space-2);align-items:center;">
										{#if s.auditor}<Badge status={s.auditor}/>{/if}
										<span style="font-family:var(--font-mono);font-size:var(--text-xs);color:var(--text-muted);">{fmt.tokens(s.tokensUsed)} tok</span>
									</div>
								</div>
								<p style="font-size:var(--text-xs);margin:0;line-height:1.5;">{s.summary}</p>
								<div style="font-family:var(--font-mono);font-size:10px;color:var(--text-muted);margin-top:4px;">{fmt.ago(s.createdAt)}</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>
