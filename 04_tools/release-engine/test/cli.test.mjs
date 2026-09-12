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
