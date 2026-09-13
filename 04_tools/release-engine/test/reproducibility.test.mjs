import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { verifyReproducibilityCommand } from '../src/reproducibility.mjs';
import { digest, prettyStableJson, sha256 } from '../src/stable.mjs';

test('two isolated cold Prepare roots prove identical archives, manifests and file lists', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ai-delivery-reproducibility-'));
  const left = await coldPackage(join(root, 'cold-a'));
  const right = await coldPackage(join(root, 'cold-b'));
  const output = join(root, 'evidence.json');
  const result = await verifyReproducibilityCommand(null, { leftPackage: left, rightPackage: right, output });

  assert.equal(result.isolatedStateRoots, true);
  assert.deepEqual(result.coldPackageCaches, ['miss', 'miss']);
  assert.ok(Object.values(result.comparisons).every(Boolean));
  assert.equal(JSON.parse(await readFile(output, 'utf8')).archive.sha256, result.archive.sha256);
});

test('reproducibility proof rejects a cache hit and independently different output', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ai-delivery-reproducibility-negative-'));
  const left = await coldPackage(join(root, 'cold-a'));
  const cached = await coldPackage(join(root, 'cold-b'), { packageCache: 'hit_local' });
  await assert.rejects(
    () => verifyReproducibilityCommand(null, { leftPackage: left, rightPackage: cached }),
    (error) => error.code === 'REPRODUCIBILITY_RIGHT_CACHE_NOT_COLD'
  );

  const different = await coldPackage(join(root, 'cold-c'), { fileBody: 'different' });
  await assert.rejects(
    () => verifyReproducibilityCommand(null, { leftPackage: left, rightPackage: different }),
    (error) => error.code === 'REPRODUCIBILITY_MISMATCH'
  );
});

async function coldPackage(stateRoot, options = {}) {
  const run = join(stateRoot, 'runs', 'run');
  const artifactRoot = join(stateRoot, 'artifacts', 'app');
  await mkdir(run, { recursive: true });
  await mkdir(artifactRoot, { recursive: true });
  const body = Buffer.from(options.fileBody ?? 'same');
  const archive = Buffer.from('same archive');
  const archivePath = join(artifactRoot, 'app.tar.gz');
  await writeFile(archivePath, archive);
  const entries = [{ path: 'app/file.txt', type: 'file', mode: 420, bytes: body.byteLength, sha256: sha256(body) }];
  const unsigned = {
    schema: 'ai.delivery.artifact.v1',
    engineVersion: 2,
    project: 'fixture',
    target: 'app',
    sourceSha: 'a'.repeat(40),
    treeDigest: digest(entries),
    entries,
    archive: { sha256: `sha256:${sha256(archive)}`, bytes: archive.byteLength },
  };
  const manifest = { ...unsigned, manifestDigest: digest(unsigned) };
  const manifestPath = join(artifactRoot, 'app.artifact.json');
  await writeFile(manifestPath, prettyStableJson(manifest));
  const packagePath = join(run, 'package.json');
  await writeFile(
    packagePath,
    prettyStableJson({
      schema: 'ai.delivery.package-set.v1',
      project: 'fixture',
      runId: stateRoot.endsWith('cold-a') ? 'cold-a' : 'cold-b',
      stateRoot,
      sourceSha: 'a'.repeat(40),
      prepare: true,
      artifacts: [{ ...manifest, archive: { ...manifest.archive, path: archivePath }, manifestPath, packageCache: options.packageCache ?? 'miss' }],
    })
  );
  return packagePath;
}
