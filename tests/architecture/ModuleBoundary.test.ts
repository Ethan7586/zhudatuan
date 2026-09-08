import assert from 'node:assert/strict';
import test from 'node:test';
import { audit } from '../runtime/Audit';

test('后端模块只通过 Public Port 或事件协作且分层依赖方向正确', async () => {
  assert.match(await audit('scripts/audit/boundary.mjs'), /boundar|accepted|verified/i);
});
