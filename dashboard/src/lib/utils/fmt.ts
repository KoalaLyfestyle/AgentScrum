export const fmt = {
	tokens: (n: number | null | undefined): string => {
		if (!n) return '—';
		if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
		if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k';
		return String(Math.round(n));
	},
	date: (iso: string | null | undefined): string => {
		if (!iso) return '—';
		return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
	},
	month: (iso: string | null | undefined): string => {
		if (!iso) return '—';
		return new Date(iso).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
	},
	ago: (iso: string | null | undefined): string => {
		if (!iso) return '—';
		const m = (Date.now() - new Date(iso).getTime()) / 60e3;
		if (m < 60) return Math.round(m) + 'm ago';
		if (m < 1440) return Math.round(m / 60) + 'h ago';
		return Math.round(m / 1440) + 'd ago';
	}
};
