import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import {
  materializeSflConsoleArtifact,
  resolveConsoleAppConfig,
} from '@shop/config/sfl-console-runtime';
import { SFL_CONSOLE_RELEASE_DECLARATION } from '@shop/config/sfl-node-registry';
import { readConsoleArtifact, validateConsoleArtifactManifest } from '../../../04_tools/scripts/release/console-artifact.mjs';
import { consoleImmutableArtifactDigest } from '../../../04_tools/scripts/release/console-digest.mjs';

const root = resolve(import.meta.dirname, '../../..');
const sourceSha = 'a'.repeat(40);

async function manifest(sourceTree = 'clean', immutableArtifactDigest = `sha256:${'b'.repeat(64)}`) {
  return await materializeSflConsoleArtifact(SFL_CONSOLE_RELEASE_DECLARATION, {
    source_sha: sourceSha,
    build_id: 'console:test:single-build',
    source_tree: sourceTree,
    client_version: '1.0.0',
    immutable_artifact_digest: immutableArtifactDigest,
  });
}

test('one raw Console production build works without node-specific API or identity build variables', async () => {
  const vite = resolve(root, 'node_modules/vite/bin/vite.js');
  const result = spawnSync(process.execPath, [vite, 'build', '--mode', 'release-missing-config'], {
    cwd: resolve(root, '01_core_hexin/apps/console'),
    encoding: 'utf8',
    env: {
      ...process.env,
      SHOP_BUILD_COMMIT: sourceSha,
      SHOP_BUILD_DIRTY: 'false',
      VITE_API_BASE_URL: 'http://127.0.0.1:3001',
      VITE_AUTH_BASE_URL: 'http://127.0.0.1:3002',
      VITE_CLIENT_VERSION: '1.0.0',
    },
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const dist = resolve(root, '01_core_hexin/apps/console/dist');
  const artifact = await readConsoleArtifact(dist, { expectedCommit: sourceSha, requireClean: true });
  const l0 = resolveConsoleAppConfig(artifact.manifest, 'console.fufu.wang');
  const l1 = resolveConsoleAppConfig(artifact.manifest, 'console.hbbtzn.com');
  assert.equal(l0.apiBaseUrl, 'https://api.fufu.wang');
  assert.equal(l1.apiBaseUrl, 'https://api.hbbtzn.com');
  assert.equal(l0.sourceSha, l1.sourceSha);
  assert.equal(l0.immutableArtifactDigest, l1.immutableArtifactDigest);
  const builtText = [
    readFileSync(join(dist, 'index.html'), 'utf8'),
    ...readdirSync(join(dist, 'assets')).filter((name) => name.endsWith('.js'))
      .map((name) => readFileSync(join(dist, 'assets', name), 'utf8')),
  ].join('\n');
  assert.doesNotMatch(builtText, /%VITE_API_BASE_URL%/);
  assert.doesNotMatch(builtText, /CLIENT_API_BASE_URL_MISSING/);
});

test('Console artifact binds the final immutable payload to two full generic NodeManifests', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'shop-console-artifact-'));
  try {
    mkdirSync(join(directory, '.vite'));
    writeFileSync(join(directory, 'index.html'), '<main>console</main>');
    writeFileSync(join(directory, '.vite/manifest.json'), '{}');
    const immutableArtifactDigest = consoleImmutableArtifactDigest(directory);
    writeFileSync(join(directory, 'console-build.json'), JSON.stringify(await manifest('clean', immutableArtifactDigest)));
    const artifact = await readConsoleArtifact(directory, { expectedCommit: sourceSha, requireClean: true });
    const l0 = resolveConsoleAppConfig(artifact.manifest, 'console.fufu.wang');
    const l1 = resolveConsoleAppConfig(artifact.manifest, 'console.hbbtzn.com');
    assert.equal(l0.nodeContext.signed_level, 'L0');
    assert.equal(l1.nodeContext.signed_level, 'L1');
    assert.equal(l0.nodeManifest.release_pointer_ref.immutable_artifact_digest, immutableArtifactDigest);
    assert.equal(l1.nodeManifest.release_pointer_ref.immutable_artifact_digest, immutableArtifactDigest);
    assert.match(artifact.sha256, /^[0-9a-f]{64}$/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('release acceptance rejects dirty, mismatched, or tampered Console artifacts', async () => {
  await assert.rejects(
    validateConsoleArtifactManifest(await manifest('dirty'), { requireClean: true }),
    /CONSOLE_ARTIFACT_SOURCE_TREE_DIRTY/,
  );
  await assert.rejects(
    validateConsoleArtifactManifest(await manifest(), { expectedCommit: 'b'.repeat(40) }),
    /CONSOLE_ARTIFACT_COMMIT_MISMATCH/,
  );

  const directory = mkdtempSync(join(tmpdir(), 'shop-console-tampered-'));
  try {
    mkdirSync(join(directory, '.vite'));
    writeFileSync(join(directory, 'index.html'), '<main>console</main>');
    writeFileSync(join(directory, '.vite/manifest.json'), '{}');
    const immutableArtifactDigest = consoleImmutableArtifactDigest(directory);
    writeFileSync(join(directory, 'console-build.json'), JSON.stringify(await manifest('clean', immutableArtifactDigest)));
    writeFileSync(join(directory, 'index.html'), '<main>tampered</main>');
    await assert.rejects(readConsoleArtifact(directory), /CONSOLE_IMMUTABLE_ARTIFACT_DIGEST_MISMATCH/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
