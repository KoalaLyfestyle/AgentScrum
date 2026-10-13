import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	define: {
		// Absolute path of the AgentScrum checkout, for DB path resolution (hooks.server.ts).
		__AGENTSCRUM_ROOT__: JSON.stringify(resolve(__dirname, '..'))
	},
	ssr: {
		// Bundle drizzle-orm from the root package (the copy that owns the schema),
		// so dev and build use the same single drizzle version.
		noExternal: ['drizzle-orm']
	},
	resolve: {
		alias: {
			$scrum: resolve(__dirname, '../src')
		}
	}
});
