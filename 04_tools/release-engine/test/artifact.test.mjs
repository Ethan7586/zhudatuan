import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { materializeTarget, packageTarget, resolvePackageArtifactPaths } from '../src/artifact.mjs';
import { digest } from '../src/stable.mjs';

test('packages only existing changed files and records deletions', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ai-delivery-artifact-'));
  await mkdir(join(root, 'public', 'media'), { recursive: true });
  await writeFile(join(root, 'public', 'media', 'new.webp'), 'new');
  await mkdir(join(root, 'node_modules', 'fake-cache'), { recursive: true });
  await writeFile(join(root, 'node_modules', 'fake-cache', 'huge.bin'), Buffer.alloc(8 * 1024 * 1024));
  await mkdir(join(root, '.git', 'objects'), { recursive: true });
  await mkdir(join(root, '.turbo'), { recursive: true });
  await mkdir(join(root, 'releases', 'old'), { recursive: true });
  const adapter = {
    project: 'fixture',
    projectRoot: root,
    targets: {
      media: {
        kind: 'content',
        artifactInputs: [{ source: 'public/media', destination: 'content', changedOnly: true }],
        criticalFiles: [],
      },
    },
  };
  const run = join(root, 'run');
  const evidence = await materializeTarget(adapter, 'media', run, [
    { status: 'A', path: 'public/media/new.webp', sourcePath: null },
    { status: 'D', path: 'public/media/old.webp', sourcePath: null },
  ]);
  assert.equal(await readFile(join(evidence.directory, 'content', 'new.webp'), 'utf8'), 'new');
  assert.deepEqual(evidence.deletions, ['content/old.webp']);

  const plan = { lane: 'A0', to: { sha: 'a'.repeat(40) }, planDigest: digest({ test: true }) };
  const artifact = await packageTarget(adapter, plan, evidence, run, join(root, 'artifacts'));
  assert.deepEqual(artifact.deletions, ['content/old.webp']);
  assert.match(artifact.archive.sha256, /^sha256:[a-f0-9]{64}$/);
  assert.match(artifact.manifestDigest, /^sha256:[a-f0-9]{64}$/);
  assert.equal(artifact.totalBytes, 3);
  assert.deepEqual(artifact.entries.map((entry) => entry.path), ['content/', 'content/new.webp']);
  const storedManifest = JSON.parse(await readFile(artifact.manifestPath, 'utf8'));
  assert.equal(storedManifest.archive.path, undefined);

  const reused = await packageTarget(adapter, plan, evidence, run, join(root, 'artifacts'));
  assert.equal(reused.archive.path, artifact.archive.path);
  assert.equal(reused.archive.sha256, artifact.archive.sha256);
  assert.equal(reused.manifestDigest, artifact.manifestDigest);
  assert.equal(reused.packageCache, 'hit_local');

  await utimes(join(evidence.directory, 'content', 'new.webp'), new Date(), new Date());
  const rebuilt = await packageTarget(adapter, plan, evidence, run, join(root, 'second-artifact-store'));
  assert.equal(rebuilt.packageCache, 'miss');
  assert.equal(rebuilt.archive.sha256, artifact.archive.sha256);
  assert.equal(rebuilt.archive.bytes, artifact.archive.bytes);
  assert.equal(rebuilt.manifestDigest, artifact.manifestDigest);
});

test('rejects forbidden directories even when they appear inside an allowed target source', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ai-delivery-forbidden-'));
  await mkdir(join(root, 'dist', 'node_modules', 'bad'), { recursive: true });
  await writeFile(join(root, 'dist', 'index.js'), 'export {}');
  await writeFile(join(root, 'dist', 'node_modules', 'bad', 'index.js'), 'bad');
  const adapter = {
    project: 'fixture',
    projectRoot: root,
    targets: { app: { kind: 'frontend', artifactInputs: [{ source: 'dist', destination: 'app' }], criticalFiles: [] } },
  };
  await assert.rejects(
    () => materializeTarget(adapter, 'app', join(root, 'run')),
    (error) => error.code === 'ARTIFACT_FORBIDDEN_PATH',
  );
});

test('resolves candidate artifact paths after the package moves to another CI runner', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'ai-delivery-portable-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const portable = join(root, '.ai-delivery', 'artifacts', 'app', 'digest', 'v2');
  const packagePath = join(root, '.ci-release', 'package.json');
  await mkdir(portable, { recursive: true });
  await mkdir(join(root, '.ci-release'), { recursive: true });
  await writeFile(join(portable, 'app.tar.gz'), 'archive');
  await writeFile(join(portable, 'app.artifact.json'), '{}');

  const relocated = await resolvePackageArtifactPaths(packagePath, {
    artifacts: [{
      target: 'app',
      archive: { path: '/old/runner/.ai-delivery/artifacts/app/digest/v2/app.tar.gz' },
      manifestPath: '/old/runner/.ai-delivery/artifacts/app/digest/v2/app.artifact.json',
    }],
  });
  assert.equal(relocated.artifacts[0].archive.path, join(portable, 'app.tar.gz'));
  assert.equal(relocated.artifacts[0].manifestPath, join(portable, 'app.artifact.json'));
});
