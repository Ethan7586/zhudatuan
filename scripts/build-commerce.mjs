import { build } from 'esbuild';

await build({
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  bundle: true,
  entryPoints: {
    ApiMain: 'services/commerce/src/entry/ApiMain.ts',
    JobsMain: 'services/commerce/src/entry/JobsMain.ts',
    ProviderMain: 'services/commerce/src/entry/ProviderMain.ts',
    MigrationMain: 'services/commerce/src/entry/MigrationMain.ts',
    SmokeMain: 'services/commerce/src/entry/SmokeMain.ts',
  },
  format: 'esm',
  external: ['@aws-sdk/client-s3'],
  outdir: 'services/commerce/dist',
  packages: 'bundle',
  platform: 'node',
  sourcemap: true,
});
