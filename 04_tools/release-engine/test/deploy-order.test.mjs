import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { deployCommand } from '../src/engine.mjs';

test('failed production database migration blocks consumer activation without affecting candidate staging semantics', async () => {
  const production = await fixture();
  await assert.rejects(() => deployCommand(production.adapter, {
    package: production.packagePath,
    nodes: ['local'],
    environment: 'production',
    approveProduction: `fixture:${production.sourceSha}`,
  }), (error) => {
    assert.equal(error.code, 'DEPLOYMENT_OBJECTS_FAILED');
    assert.equal(error.details.results[0].target, 'database-migration');
    assert.equal(error.details.results[0].ok, false);
    assert.equal(error.details.results[1].target, 'consumer');
    assert.equal(error.details.results[1].skipped, true);
    assert.equal(error.details.results[1].error.code, 'DATABASE_MIGRATION_DEPENDENCY_FAILED');
    return true;
  });
  await assert.rejects(() => readFile(join(production.localRoot, 'local', 'consumer', 'current.txt')), { code: 'ENOENT' });

  const candidate = await fixture();
  await assert.rejects(() => deployCommand(candidate.adapter, {
    package: candidate.packagePath,
    nodes: ['local'],
    environment: 'candidate',
  }), (error) => {
    assert.equal(error.code, 'DEPLOYMENT_OBJECTS_FAILED');
    assert.equal(error.details.results[0].ok, false);
    assert.equal(error.details.results[1].ok, true);
    return true;
  });
  assert.match(await readFile(join(candidate.localRoot, 'local', 'consumer', 'candidate.txt'), 'utf8'), /releases/);
});

test('explicit deployment target ignores unrelated packaged migration artifacts', async () => {
  const scoped = await fixture();
  const result = await deployCommand(scoped.adapter, {
    package: scoped.packagePath,
    nodes: ['local'],
    target: 'consumer',
    environment: 'production',
    approveProduction: `fixture:${scoped.sourceSha}`,
  });
  assert.equal(result.finalStatus, 'success');
  assert.deepEqual(result.requestedTargets, ['consumer']);
  assert.deepEqual(result.results.map((item) => item.target), ['consumer']);
  await assert.rejects(() => readFile(join(scoped.localRoot, 'local', 'database-migration', 'current.txt')),
    (error) => ['ENOENT', 'ENOTDIR'].includes(error.code));
  assert.match(await readFile(join(scoped.localRoot, 'local', 'consumer', 'current.txt'), 'utf8'), /releases/);
});

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'ai-delivery-deploy-order-'));
  const localRoot = join(root, 'remote');
  const run = join(root, 'run');
  const artifacts = join(root, 'artifacts');
  await mkdir(join(localRoot, 'local'), { recursive: true });
  await mkdir(run, { recursive: true });
  await mkdir(artifacts, { recursive: true });
  await writeFile(join(localRoot, 'local', 'database-migration'), 'force migration deployment failure\n');
  const archive = join(artifacts, 'artifact.tar.gz');
  const manifest = join(artifacts, 'artifact.json');
  await writeFile(archive, 'artifact');
  await writeFile(manifest, '{}\n');
  const sourceSha = 'a'.repeat(40);
  const packagePath = join(run, 'package.json');
  await writeFile(packagePath, JSON.stringify({
    schema: 'ai.delivery.package-set.v1',
    project: 'fixture',
    sourceSha,
    deploymentOrder: ['database-migration', 'consumer'],
    artifacts: [
      artifact('database-migration', '1', archive, manifest),
      artifact('consumer', '2', archive, manifest),
    ],
    timings: { package: 0 },
  }));
  const adapter = {
    project: 'fixture',
    projectRoot: root,
    stateDirectory: '.state',
    transport: { kind: 'local', localRoot },
    targets: {
      'database-migration': { kind: 'migration' },
      consumer: { kind: 'service', after: ['database-migration'] },
    },
    nodes: {
      local: {
        key: 'local',
        nodeId: 'local',
        deployments: {
          'database-migration': { pointerRoot: '/unused/database-migration', service: 'none' },
          consumer: { pointerRoot: '/unused/consumer', service: 'consumer.service' },
        },
      },
    },
  };
  return { adapter, localRoot, packagePath, sourceSha };
}

function artifact(target, digestCharacter, archive, manifestPath) {
  return {
    target,
    sourceSha: 'a'.repeat(40),
    treeDigest: `sha256:${digestCharacter.repeat(64)}`,
    manifestDigest: `sha256:${digestCharacter.repeat(64)}`,
    manifestPath,
    archive: { path: archive, sha256: `sha256:${digestCharacter.repeat(64)}`, bytes: 8 },
  };
}
