import { build } from 'esbuild';

await build({
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  bundle: true,
  entryPoints: [
    '01_core_hexin/services/commerce/src/entry/ApiMain.ts',
    '01_core_hexin/services/commerce/src/entry/JobsMain.ts',
    '01_core_hexin/services/commerce/src/entry/MigrationMain.ts',
    '01_core_hexin/services/commerce/src/entry/SmokeMain.ts',
  ],
  format: 'esm',
  outdir: '01_core_hexin/services/commerce/dist',
  packages: 'bundle',
  platform: 'node',
  sourcemap: true,
});
