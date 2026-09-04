import { createHash } from 'node:crypto';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const output = join(root, '05_docs_ziliao/docs_wendang/evidence/frontend/files.json');
const sourceRoots = [
  '01_core_hexin/apps/console',
  '01_core_hexin/apps/auth-web',
  '01_core_hexin/apps/storefront-web',
  '01_core_hexin/apps/miniapp',
  '01_core_hexin/packages/design',
  '01_core_hexin/packages/sdk',
  '01_core_hexin/packages/contract',
  '01_core_hexin/packages/testing',
  '01_core_hexin/packages/authz',
  '01_core_hexin/packages/config',
  '01_core_hexin/packages/telemetry',
];
const excludedDirectories = new Set([
  '.next',
  '.vinext',
  '.wrangler',
  'coverage',
  'dist',
  'node_modules',
  'storybook-static',
]);

const entries = [];
for (const sourceRoot of sourceRoots) {
  await visit(join(root, sourceRoot));
}
entries.sort((left, right) => left.path.localeCompare(right.path));

const canonical = entries.map((entry) => [entry.path, entry.sha256, entry.size, entry.mode].join('\0')).join('\n');
const document = {
  version: 1,
  roots: sourceRoots,
  count: entries.length,
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
    const [bytes, metadata] = await Promise.all([readFile(absolute), stat(absolute)]);
    entries.push({
      path: relative(root, absolute).split(sep).join('/'),
      sha256: sha256(bytes),
      size: bytes.length,
      mode: (metadata.mode & 0o777).toString(8).padStart(4, '0'),
    });
  }
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}
