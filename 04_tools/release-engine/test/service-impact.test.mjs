import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const adapterRoot = join(projectRoot, '04_tools/release-engine/adapters/zdt-next');

test('migration build workspace does not make commerce source changes select a migration', async () => {
  const { resolveImpact } = await import(pathToFileURL(join(adapterRoot, 'workspace-impact.mjs')).href);
  const result = await resolveImpact({
    adapter: { projectRoot, targets: { identity: { workspace: '@shop/commerce' }, 'database-migration': { kind: 'migration', buildWorkspace: '@shop/commerce' } } },
    changes: [{ path: '01_core_hexin/services/commerce/src/foundation/infrastructure/MigrationRunner.ts' }],
    refs: {},
  });
  assert.deepEqual(result.targets, ['identity']);
});

test('isolated release control resolves esbuild from the exact source project', async () => {
  const controlRoot = await mkdtemp(join(tmpdir(), 'zdt-control-impact-'));
  try {
    const isolatedAdapterRoot = join(controlRoot, '04_tools/release-engine/adapters/zdt-next');
    await mkdir(isolatedAdapterRoot, { recursive: true });
    for (const name of ['service-impact.mjs', 'service-targets.mjs', 'workspace-resolver.mjs']) {
      await writeFile(join(isolatedAdapterRoot, name), await readFile(join(adapterRoot, name)));
    }
    const isolated = await import(pathToFileURL(join(isolatedAdapterRoot, 'service-impact.mjs')).href);
    const result = await isolated.resolveImpact({ adapter: { projectRoot }, changes: [] });
    assert.deepEqual(result, { targets: [], reasons: ['changed commerce files are validation-only'] });
  } finally {
    await rm(controlRoot, { recursive: true, force: true });
  }
});
