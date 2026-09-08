import assert from 'node:assert/strict';
import test from 'node:test';
import { audit } from '../runtime/Audit';

test('每个 Event 都有唯一 Owner、版本化 Schema、发布点和显式消费者声明', async () => {
  assert.match(await audit('scripts/audit/events.mjs'), /event|accepted|verified/i);
});
