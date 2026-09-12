import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';

import { workspaceResolver } from './workspace-resolver.mjs';

const outfile = '01_core_hexin/services/commerce/dist/DatabaseMigrationExecutor.js';
await mkdir('01_core_hexin/services/commerce/dist', { recursive: true });
await build({
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  bundle: true,
  entryPoints: ['04_tools/release-engine/adapters/zdt-next/database-migration-executor.mjs'],
  format: 'esm',
  outfile,
  packages: 'bundle',
  platform: 'node',
  plugins: [await workspaceResolver(process.cwd())],
  sourcemap: true,
});
console.log(`database migration executor build: ${outfile}`);
