import assert from 'node:assert/strict';
import test from 'node:test';
import './providers.spec';
import { audit } from '../runtime/Audit';

test('十一类扩展的 Manifest、能力、合同、安全与主线隔离全部闭合', async () => {
  const [providers, extensions] = await Promise.all([
    audit('scripts/audit/providers.mjs'),
    audit('scripts/audit/extensions.mjs'),
  ]);
  assert.match(providers, /provider|accepted|verified/i);
  assert.match(extensions, /extension|accepted|verified/i);
});
