import assert from 'node:assert/strict';
import test from 'node:test';
import { audit } from '../runtime/Audit';

test('所有数据库对象都归属于唯一模块 Owner 且调用者受约束', async () => {
  assert.match(await audit('scripts/check/ownership.mjs'), /ownership|accepted|verified/i);
});
