import { build } from 'esbuild';
import { mkdir, rm } from 'node:fs/promises';

import { workspaceResolver } from './workspace-resolver.mjs';

const outputRoot = '04_tools/release-engine/dist/node-operations';
const outfile = `${outputRoot}/autonode-activate-runtime.mjs`;

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });
await build({
  bundle: true,
  entryPoints: ['04_tools/scripts/provisioning/autonode-activate.mjs'],
  format: 'esm',
  outfile,
  packages: 'bundle',
  platform: 'node',
  plugins: [await workspaceResolver(process.cwd())],
  target: 'node22',
});
console.log(`node operations runtime build: ${outfile}`);
