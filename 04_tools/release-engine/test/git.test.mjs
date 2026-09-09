import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { writeFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

import { assertWorktreeClean } from '../src/git.mjs';

const run = promisify(execFile);

test('production installation accepts only a clean committed worktree', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ai-delivery-git-'));
  await run('git', ['init', '-q'], { cwd: root });
  await writeFile(join(root, 'tracked.txt'), 'committed\n');
  await run('git', ['add', 'tracked.txt'], { cwd: root });
  await run('git', ['-c', 'user.name=AI Delivery Test', '-c', 'user.email=delivery@example.invalid', 'commit', '-qm', 'fixture'], { cwd: root });
  await assert.doesNotReject(() => assertWorktreeClean(root));

  await writeFile(join(root, 'tracked.txt'), 'dirty\n');
  await assert.rejects(() => assertWorktreeClean(root), (error) => {
    assert.equal(error.code, 'WORKTREE_NOT_CLEAN');
    assert.deepEqual(error.details.paths, [' M tracked.txt']);
    return true;
  });
});
