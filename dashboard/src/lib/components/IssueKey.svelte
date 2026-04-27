<script lang="ts">
	let { epicNum, issueNum }: { epicNum: number | string; issueNum: number | string } = $props();
	let eStr = $derived(String(epicNum).padStart(2, '0'));
	let iStr = $derived(String(issueNum).padStart(2, '0'));
</script>

<code style="font-family:var(--font-mono);font-size:var(--text-xs);color:var(--accent-ember);background:var(--accent-warm);padding:2px 6px;border-radius:var(--radius-sm);white-space:nowrap;">E{eStr}-I{iStr}</code>
