import { createHash } from 'node:crypto';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const output = join(root, 'docs/evidence/frontend/files.json');
const sourceRoots = [
  'apps/auth',
  'apps/console',
  'apps/storefront',
  'apps/miniapp',
  'apps/store',
  'apps/supplier',
  'packages/design',
  'packages/presentation',
  'packages/sdk',
  'packages/contract',
  'packages/testing',
  'packages/authz',
  'packages/config',
  'packages/telemetry',
];
const authorityFiles = ['config/visuals.yml', 'config/navigation.yml', 'docs/architecture/福利商城理想方案20260904.md', 'docs/architecture/福利商城代码修改清单20260904.md'];
const excludedDirectories = new Set(['.next', '.vinext', '.wrangler', 'coverage', 'dist', 'node_modules', 'storybook-static']);

const entries = [];
for (const sourceRoot of sourceRoots) {
  await visit(join(root, sourceRoot));
}
for (const authorityFile of authorityFiles) {
  await record(join(root, authorityFile));
}
entries.sort((left, right) => left.path.localeCompare(right.path));

const canonical = entries.map((entry) => [entry.path, entry.sha256, entry.size, entry.mode].join('\0')).join('\n');
const coverage = Object.freeze(Object.fromEntries(['manifest', 'viewmodel', 'view', 'route', 'test', 'binding'].map((kind) => [kind, entries.filter((entry) => entry.kind === kind).length])));
const document = {
  version: 2,
  roots: sourceRoots,
  authorities: authorityFiles,
  count: entries.length,
  coverage,
  treeSha256: sha256(Buffer.from(canonical)),
  entries,
};
const content = JSON.stringify(document, null, 2) + '\n';
if (process.argv.includes('--check')) {
  const current = await readFile(output, 'utf8').catch(() => '');
  if (current !== content) throw new Error('FRONTEND_FILE_MANIFEST_DRIFT');
} else {
  await writeFile(output, content, 'utf8');
}

async function visit(directory) {
  const children = await readdir(directory, { withFileTypes: true });
  for (const child of children) {
    if (child.isDirectory() && excludedDirectories.has(child.name)) continue;
    const absolute = join(directory, child.name);
    if (child.isDirectory()) {
      await visit(absolute);
      continue;
    }
    if (!child.isFile() || child.name.endsWith('.tsbuildinfo')) continue;
    await record(absolute);
  }
}

async function record(absolute) {
  const [bytes, metadata] = await Promise.all([readFile(absolute), stat(absolute)]);
  entries.push({
    path: relative(root, absolute).split(sep).join('/'),
    kind: evidenceKind(relative(root, absolute).split(sep).join('/')),
    sha256: sha256(bytes),
    size: bytes.length,
    mode: (metadata.mode & 0o777).toString(8).padStart(4, '0'),
  });
}

function evidenceKind(path) {
  if (/\/Manifest\.ts$/.test(path)) return 'manifest';
  if (/\/generated\/(?:Route|Navigation)Binding\.ts$/.test(path)) return 'binding';
  if (/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(path)) return 'test';
  if (path.includes('/viewmodel/')) return 'viewmodel';
  if (path.includes('/view/')) return 'view';
  if (path.includes('/route/')) return 'route';
  return 'support';
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}
