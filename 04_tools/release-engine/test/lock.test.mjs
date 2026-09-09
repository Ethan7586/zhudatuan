import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { acquireLocks } from '../src/lock.mjs';

test('allows exactly one owner for the same target lock', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ai-delivery-lock-'));
  const path = join(root, 'target.lock');
  const release = await acquireLocks([path], { project: 'fixture', node: 'l1', target: 'web' });
  const owner = JSON.parse(await readFile(join(path, 'owner.json'), 'utf8'));
  assert.equal(owner.project, 'fixture');
  assert.equal(typeof owner.publisher, 'string');
  assert.equal(owner.node, 'l1');
  assert.equal(owner.target, 'web');
  assert.ok(Date.parse(owner.startedAt) > 0);
  await assert.rejects(() => acquireLocks([path], { project: 'other' }), (error) => error.code === 'DELIVERY_LOCKED');
  await release();
  const secondRelease = await acquireLocks([path], { project: 'second' });
  await secondRelease();
});

test('releases earlier locks when a later lock is occupied', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ai-delivery-lock-partial-'));
  const first = join(root, 'a.lock');
  const second = join(root, 'b.lock');
  const holdSecond = await acquireLocks([second]);
  await assert.rejects(() => acquireLocks([first, second]), (error) => error.code === 'DELIVERY_LOCKED');
  const holdFirst = await acquireLocks([first]);
  await holdFirst();
  await holdSecond();
});

test('recovers a local lock whose owning process is gone', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ai-delivery-lock-stale-'));
  const path = join(root, 'target.lock');
  await mkdir(path);
  await writeFile(join(path, 'owner.json'), JSON.stringify({ host: (await import('node:os')).hostname(), pid: 2147483647 }));
  const release = await acquireLocks([path], { project: 'recovered' });
  const owner = JSON.parse(await readFile(join(path, 'owner.json'), 'utf8'));
  assert.equal(owner.project, 'recovered');
  await release();
});
