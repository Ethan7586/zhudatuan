import { build } from 'esbuild';
import { BUNDLED_ENTRY_POINTS } from './lib/CommerceEntries.mjs';

await build({
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  bundle: true,
  entryPoints: BUNDLED_ENTRY_POINTS,
  format: 'esm',
  external: ['@aws-sdk/client-s3'],
  outdir: 'services/commerce/dist',
  packages: 'bundle',
  platform: 'node',
  sourcemap: true,
});
