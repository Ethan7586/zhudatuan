import assert from 'node:assert/strict';
import { access, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';

const featureRoot = 'apps/console/src/feature';

test('console keeps one production authority for access, member and profile semantics', async () => {
  const topLevel = await readdir(featureRoot);
  assert.equal(topLevel.includes('access'), false);
  assert.equal(topLevel.includes('member'), false);
  assert.equal(topLevel.includes('profile'), false);
  await Promise.all([
    access(join(featureRoot, 'settings/access')),
    access(join(featureRoot, 'settings/member')),
    access('apps/console/src/entity/session'),
  ]);
});

test('console runtime never imports the LI reference repository', async () => {
  const files = await sourceFiles('apps/console/src');
  const sources = await Promise.all(files.map((file) => readFile(file, 'utf8')));
  assert.equal(sources.some((source) => source.includes('zhudatuan_li')), false);
});

async function sourceFiles(directory: string): Promise<readonly string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? sourceFiles(path) : Promise.resolve(/\.(?:ts|tsx)$/.test(entry.name) ? [path] : []);
    })
  );
  return nested.flat();
}
