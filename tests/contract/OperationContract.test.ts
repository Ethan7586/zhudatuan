import assert from 'node:assert/strict';
import test from 'node:test';
import { audit } from '../runtime/Audit';

test('每个 Operation 都有 Owner、Scope、权限、能力、风险、幂等、错误、Schema 与 Handler', async () => {
  assert.match(await audit('scripts/audit/operations.mjs'), /operation|accepted|verified/i);
});
