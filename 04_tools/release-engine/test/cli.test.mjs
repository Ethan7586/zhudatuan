import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const releaseEngineRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

test('external baseline is an explicit boolean CLI option', () => {
  const result = spawnSync(process.execPath, ['cli.mjs', 'deploy', '--external-baseline', '--help'], {
    cwd: releaseEngineRoot,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /统一 AI 发布引擎/);
});

test('direct deployment is an explicit boolean CLI option', () => {
  const result = spawnSync(process.execPath, ['cli.mjs', 'deploy', '--direct', '--help'], {
    cwd: releaseEngineRoot,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /统一 AI 发布引擎/);
});

test('artifact preparation is an explicit boolean CLI option with separate publish and deploy commands', () => {
  const result = spawnSync(process.execPath, ['cli.mjs', 'plan', '--prepare', '--help'], {
    cwd: releaseEngineRoot,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /publish\|deploy-prepared/);
  assert.match(result.stdout, /--prepare/);
});
