import { rmSync } from 'node:fs';
import * as esbuild from 'esbuild';

const watch = process.argv.includes('--watch');
const options = {
	entryPoints: ['src/extension.ts'],
	bundle: true,
	outfile: 'dist/extension.js',
	external: ['vscode'],
	format: 'cjs',
	platform: 'node',
	target: 'node20',
	sourcemap: watch,
	logLevel: 'info',
};

if (watch) {
	const context = await esbuild.context(options);
	await context.watch();
} else {
	rmSync('dist', { recursive: true, force: true });
	await esbuild.build(options);
}
