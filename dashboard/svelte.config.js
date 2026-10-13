import adapter from '@sveltejs/adapter-node';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		// adapter-node: a plain Node server (node build), used by the container.
		adapter: adapter({ out: 'build' }),
		alias: {
			$scrum: '../src'
		}
	}
};

export default config;
