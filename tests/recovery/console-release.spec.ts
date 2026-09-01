import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import { readConsoleArtifact, validateConsoleArtifactManifest } from '../../scripts/release/console-artifact.mjs';

const root = resolve(import.meta.dirname, '../..');
const commit = 'a'.repeat(40);

function manifest(sourceTree = 'clean') {
  return {
    schema: 'shop.console-artifact.v1',
    commit,
    sourceTree,
    apiBaseUrl: 'https://api.zhudatuan.com',
    authBaseUrl: 'https://accounts.zhudatuan.com',
    clientVersion: '1.0.0',
  };
}

test('raw Console production build fails before bundling when client configuration is absent', () => {
  const vite = resolve(root, 'node_modules/vite/bin/vite.js');
  const result = spawnSync(process.execPath, [vite, 'build', '--mode', 'release-missing-config'], {
    cwd: resolve(root, 'apps/console'),
    encoding: 'utf8',
    env: {
      ...process.env,
      GITHUB_SHA: commit,
      SHOP_SOURCE_TREE: 'clean',
      VITE_API_BASE_URL: '',
      VITE_AUTH_BASE_URL: '',
      VITE_CLIENT_VERSION: '',
    },
  });
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /CLIENT_API_BASE_URL_MISSING/);
});

test('Console artifact binds the final files to one clean source commit', () => {
  const directory = mkdtempSync(join(tmpdir(), 'shop-console-artifact-'));
  try {
    mkdirSync(join(directory, '.vite'));
    writeFileSync(join(directory, 'index.html'), '<main>console</main>');
    writeFileSync(join(directory, '.vite/manifest.json'), '{}');
    writeFileSync(join(directory, 'console-build.json'), JSON.stringify(manifest()));
    const artifact = readConsoleArtifact(directory, { expectedCommit: commit, requireClean: true });
    assert.equal(artifact.manifest.apiBaseUrl, 'https://api.zhudatuan.com');
    assert.match(artifact.sha256, /^[0-9a-f]{64}$/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('release acceptance rejects dirty or mismatched Console artifacts', () => {
  assert.throws(() => validateConsoleArtifactManifest(manifest('dirty'), { requireClean: true }), /CONSOLE_ARTIFACT_SOURCE_TREE_DIRTY/);
  assert.throws(() => validateConsoleArtifactManifest(manifest(), { expectedCommit: 'b'.repeat(40) }), /CONSOLE_ARTIFACT_COMMIT_MISMATCH/);
});
