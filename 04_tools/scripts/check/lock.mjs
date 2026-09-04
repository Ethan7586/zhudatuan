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

const linuxX64Native = /(?:linux-x64|linuxmusl-x64|linux-64)/;
for (const [ownerPath, entry] of Object.entries(lock.packages ?? {})) {
  for (const [dependency, version] of Object.entries(entry?.optionalDependencies ?? {})) {
    if (!linuxX64Native.test(dependency)) continue;
    const candidates = dependencyCandidates(ownerPath, dependency);
    const resolved = candidates.map((candidate) => lock.packages?.[candidate]).find((candidate) => candidate?.version === version);
    if (!resolved) throw new Error(`PACKAGE_LOCK_LINUX_X64_OPTIONAL_MISSING:${ownerPath || '.'}:${dependency}@${version}`);
  }
}
console.log('package lock: synchronized');

function dependencyCandidates(ownerPath, dependency) {
  const candidates = new Set([`node_modules/${dependency}`]);
  if (ownerPath && !ownerPath.startsWith('node_modules/')) {
    const workspace = ownerPath.split('/node_modules/')[0];
    candidates.add(`${workspace}/node_modules/${dependency}`);
  }
  let cursor = ownerPath;
  while (cursor.includes('/node_modules/')) {
    cursor = cursor.slice(0, cursor.lastIndexOf('/node_modules/'));
    candidates.add(`${cursor}/node_modules/${dependency}`);
  }
  return [...candidates];
}
