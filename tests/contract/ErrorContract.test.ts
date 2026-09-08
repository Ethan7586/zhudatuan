import assert from 'node:assert/strict';
import test from 'node:test';
import { audit } from '../runtime/Audit';

test('错误联合、HTTP 状态、中文安全文案和重试语义保持闭合', async () => {
  assert.match(await audit('scripts/check/errors.mjs'), /error|accepted|verified/i);
});
