import assert from 'node:assert/strict';
import test from 'node:test';

import { runIndependent } from '../src/run-independent.mjs';

test('starts independent work together and returns results in task order', async () => {
  const started = [];
  let finishFirst;
  const first = new Promise((resolve) => { finishFirst = resolve; });
  const result = runIndependent([
    async () => { started.push('first'); await first; return 1; },
    async () => { started.push('second'); return 2; },
  ]);
  assert.deepEqual(started, ['first', 'second']);
  finishFirst();
  assert.deepEqual(await result, [1, 2]);
});

test('waits for other independent work to settle before returning a failure', async () => {
  let finishSecond;
  const second = new Promise((resolve) => { finishSecond = resolve; });
  const failure = new Error('first failed');
  let settled = false;
  const result = runIndependent([
    async () => { throw failure; },
    async () => { await second; },
  ]).finally(() => { settled = true; });
  await Promise.resolve();
  assert.equal(settled, false);
  finishSecond();
  await assert.rejects(result, (error) => error === failure);
});
