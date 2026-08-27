import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { root as ROOT } from './source.mjs';

const root = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const lock = JSON.parse(readFileSync(join(ROOT, 'package-lock.json'), 'utf8'));
if (lock.lockfileVersion !== 3) throw new Error('PACKAGE_LOCK_VERSION_INVALID');
if (JSON.stringify(lock.packages?.['']?.workspaces) !== JSON.stringify(root.workspaces)) throw new Error('PACKAGE_LOCK_WORKSPACES_DRIFT');
for (const forbidden of ['pnpm-lock.yaml', 'yarn.lock', 'bun.lock', 'bun.lockb']) {
  if (existsSync(join(ROOT, forbidden))) throw new Error(`MULTIPLE_PACKAGE_LOCKS:${forbidden}`);
}
for (const [path, entry] of Object.entries(lock.packages ?? {})) {
  if (path === '' || path.startsWith('node_modules/') || !entry?.name) continue;
  const manifest = JSON.parse(readFileSync(join(ROOT, path, 'package.json'), 'utf8'));
  if (manifest.name !== entry.name || manifest.version !== entry.version) throw new Error(`PACKAGE_LOCK_WORKSPACE_DRIFT:${path}`);
}
console.log('package lock: synchronized');
