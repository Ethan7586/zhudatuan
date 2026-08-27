import { build } from 'esbuild';

await build({
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  bundle: true,
  entryPoints: [
    'services/commerce/src/entry/ApiMain.ts',
    'services/commerce/src/entry/JobsMain.ts',
    'services/commerce/src/entry/MigrationMain.ts',
    'services/commerce/src/entry/SmokeMain.ts',
  ],
  external: ['pg', 'redis'],
  format: 'esm',
  outdir: 'services/commerce/dist',
  platform: 'node',
  sourcemap: true,
});
