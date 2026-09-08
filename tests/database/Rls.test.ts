import assert from 'node:assert/strict';
import test from 'node:test';
import { audit } from '../runtime/Audit';

test('平台、集团、商城、门店与供应商角色权限保持最小化且 RLS 拒绝跨域读写', async () => {
  assert.match(await audit('scripts/audit/database-contracts.mjs', '--privileges'), /PRIVILEGE_EVIDENCE:.*"passed"/);
});
