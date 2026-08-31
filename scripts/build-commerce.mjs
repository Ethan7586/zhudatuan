import { build } from 'esbuild';

await build({
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  bundle: true,
  entryPoints: {
    ApiMain: 'services/commerce/src/app/ApiMain.ts',
    JobsMain: 'services/commerce/src/app/JobsMain.ts',
    ProviderMain: 'services/commerce/src/app/ProviderMain.ts',
    MigrationMain: 'services/commerce/src/app/MigrationMain.ts',
    SmokeMain: 'services/commerce/src/app/SmokeMain.ts',
  },
  format: 'esm',
  outdir: 'services/commerce/dist',
  packages: 'bundle',
  platform: 'node',
  sourcemap: true,
});
