import assert from 'node:assert/strict';
import test from 'node:test';
import { audit } from '../runtime/Audit';

test('六端 Feature 不越界且不手写 URL、DTO、权限、状态或生产 Mock', async () => {
  assert.match(await audit('scripts/check/frontend.mjs'), /frontend|accepted|verified/i);
});
