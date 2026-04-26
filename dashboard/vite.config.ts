import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'path';
import fs from 'fs';

// Parse .env file and inject into process.env before any module is loaded
const envFile = resolve(__dirname, '.env');
if (fs.existsSync(envFile)) {
	const lines = fs.readFileSync(envFile, 'utf-8').split('\n');
	for (const line of lines) {
		const m = line.match(/^([^#=]+)=(.*)$/);
		if (m) process.env[m[1].trim()] = m[2].trim();
	}
}

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	resolve: {
		alias: {
			$scrum: resolve(__dirname, '../src')
		}
	}
});
