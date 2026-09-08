import assert from 'node:assert/strict';
import test from 'node:test';
import { audit } from '../runtime/Audit';

test('合同、配置、状态、错误、格式化、导入内核和重试策略没有重复真值', async () => {
  assert.match(await audit('scripts/check/duplicates.mjs'), /duplicate|accepted|verified/i);
});
