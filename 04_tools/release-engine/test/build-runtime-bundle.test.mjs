import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { access, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

const execute = promisify(execFile);

test('node operations recovery bundle contains every runtime import', async (t) => {
  const output = await mkdtemp(join(tmpdir(), 'node-operations-bundle-'));
  t.after(() => rm(output, { recursive: true, force: true }));

  await execute(process.execPath, [
    '04_tools/scripts/release/build-runtime-bundle.mjs',
    'node-operations',
    output,
    'a'.repeat(40),
  ]);

  for (const file of [
    'autonode-operate.mjs',
    'autonode-operations-engine.mjs',
    'autonode-operations-provider.mjs',
    'autonode-control-main.mjs',
    'autonode-control-server.mjs',
    'l-arch-state-file.mjs',
    'l-arch-control.mjs',
    'autonode-task-engine.mjs',
    'autonode-task-executor.mjs',
    'autonode-activate-runtime.mjs',
  ]) {
    await access(join(output, 'runtime', file));
  }
  await access(join(output, 'systemd/sfl-autonode-control.service'));

  const checked = await execute(process.execPath, [
    '--check',
    join(output, 'runtime/autonode-control-main.mjs'),
  ]);
  assert.equal(checked.stderr, '');
});
