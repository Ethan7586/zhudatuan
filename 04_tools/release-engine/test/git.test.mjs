import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { writeFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

import { assertGitAncestor, assertWorktreeClean, commitMetadata } from '../src/git.mjs';

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

test('reads exact merge parents and the complete reconciliation message', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ai-delivery-git-metadata-'));
  await run('git', ['init', '-q'], { cwd: root });
  await writeFile(join(root, 'tracked.txt'), 'base\n');
  await run('git', ['add', 'tracked.txt'], { cwd: root });
  await run('git', ['-c', 'user.name=AI Delivery Test', '-c', 'user.email=delivery@example.invalid', 'commit', '-qm', 'base'], { cwd: root });
  const base = (await run('git', ['rev-parse', 'HEAD'], { cwd: root })).stdout.trim();
  await run('git', ['checkout', '-qb', 'production'], { cwd: root });
  await run('git', ['commit', '--allow-empty', '-qm', 'production'], { cwd: root });
  const production = (await run('git', ['rev-parse', 'HEAD'], { cwd: root })).stdout.trim();
  await run('git', ['checkout', '-q', '-b', 'mainline', base], { cwd: root });
  await run('git', ['-c', 'user.name=AI Delivery Test', '-c', 'user.email=delivery@example.invalid', 'merge', '--no-ff', '-qm', 'merge(release): reconnect L1 storefront production lineage', 'production'], { cwd: root });

  const metadata = await commitMetadata(root, 'HEAD');
  assert.deepEqual(metadata.parents, [base, production]);
  assert.equal(metadata.message, 'merge(release): reconnect L1 storefront production lineage');
});

test('closure replay accepts only an exact ancestor-to-source range', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ai-delivery-git-ancestry-'));
  await run('git', ['init', '-q'], { cwd: root });
  await writeFile(join(root, 'tracked.txt'), 'base\n');
  await run('git', ['add', 'tracked.txt'], { cwd: root });
  await run('git', ['-c', 'user.name=AI Delivery Test', '-c', 'user.email=delivery@example.invalid', 'commit', '-qm', 'base'], { cwd: root });
  const base = (await run('git', ['rev-parse', 'HEAD'], { cwd: root })).stdout.trim();
  await run('git', ['checkout', '-qb', 'left'], { cwd: root });
  await run('git', ['commit', '--allow-empty', '-qm', 'left'], { cwd: root });
  const left = (await run('git', ['rev-parse', 'HEAD'], { cwd: root })).stdout.trim();
  await run('git', ['checkout', '-qb', 'right', base], { cwd: root });
  await run('git', ['commit', '--allow-empty', '-qm', 'right'], { cwd: root });
  const right = (await run('git', ['rev-parse', 'HEAD'], { cwd: root })).stdout.trim();
  await assert.doesNotReject(() => assertGitAncestor(root, base, left));
  await assert.rejects(() => assertGitAncestor(root, right, left), (error) => error.code === 'GIT_ANCESTOR_REQUIRED');
});
