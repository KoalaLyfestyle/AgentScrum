<script lang="ts">
	const STATUS_META: Record<string, { label: string; cls: string }> = {
		todo:       { label: 'To Do',       cls: 'badge-neutral' },
		in_progress:{ label: 'In Progress', cls: 'badge-accent'  },
		review:     { label: 'Review',      cls: 'badge-warning' },
		done:       { label: 'Done',        cls: 'badge-success' },
		blocked:    { label: 'Blocked',     cls: 'badge-error'   },
		active:     { label: 'Active',      cls: 'badge-accent'  },
		closed:     { label: 'Closed',      cls: 'badge-neutral' },
		planning:   { label: 'Planning',    cls: 'badge-warning' },
		complete:   { label: 'Complete',    cls: 'badge-success' },
		paused:     { label: 'Paused',      cls: 'badge-neutral' },
		accepted:   { label: 'Accepted',    cls: 'badge-success' },
		superseded: { label: 'Superseded',  cls: 'badge-neutral' },
		pass:       { label: 'Pass',        cls: 'badge-success' },
		fail:       { label: 'Fail',        cls: 'badge-error'   },
		skipped:    { label: 'Skip',        cls: 'badge-neutral' },
	};
	const TYPE_META: Record<string, { label: string; dot: string }> = {
		feature:  { label: 'Feature',  dot: 'var(--data-5)'        },
		bugfix:   { label: 'Bug',      dot: 'var(--status-error)'  },
		refactor: { label: 'Refactor', dot: 'var(--data-3)'        },
		test:     { label: 'Test',     dot: 'var(--data-4)'        },
		docs:     { label: 'Docs',     dot: 'var(--text-muted)'    },
	};
	const PRI_META: Record<string, { label: string; color: string }> = {
		high:   { label: 'High', color: 'var(--status-error)'   },
		medium: { label: 'Med',  color: 'var(--status-warning)' },
		low:    { label: 'Low',  color: 'var(--text-muted)'     },
	};

	let {
		status,
		type,
		priority
	}: { status?: string; type?: string; priority?: string } = $props();
</script>

{#if status}
	{@const m = STATUS_META[status] ?? { label: status, cls: 'badge-neutral' }}
	<span class="badge {m.cls}">{m.label}</span>
{:else if type}
	{@const m = TYPE_META[type] ?? { label: type, dot: 'var(--text-muted)' }}
	<span class="badge badge-neutral" style="gap:5px;">
		<span style="width:6px;height:6px;border-radius:50%;background:{m.dot};flex-shrink:0;"></span>
		{m.label}
	</span>
{:else if priority}
	{@const m = PRI_META[priority] ?? { label: priority, color: 'var(--text-muted)' }}
	<span class="badge badge-neutral" style="color:{m.color};">{m.label}</span>
{/if}
