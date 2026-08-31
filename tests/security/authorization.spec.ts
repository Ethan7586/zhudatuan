import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkAssurance, decide, type MembershipAccess, type Scope } from '@shop/authz';

const mall: Scope = {
  kind: 'mall',
  id: 'mall:a',
  tenant: 'tenant:a',
  path: [
    { kind: 'tenant', id: 'tenant:a' },
    { kind: 'enterprise', id: 'enterprise:a' },
  ],
};
const access: MembershipAccess = {
  id: 'membership:a',
  active: true,
  accessVersion: 7,
  permissions: { allows: new Set(['order.read', 'payment.refund']), denies: new Set() },
  scopes: [{ effect: 'allow', scope: mall, effective: '2026-01-01T00:00:00.000Z', expires: null }],
};
const now = new Date('2026-08-21T00:00:00.000Z');

test('cross-mall, cross-tenant, stale and explicit deny paths fail closed', () => {
  assert.equal(decide(access, 'order.read', mall, { expectedAccessVersion: 7, now }).allowed, true);
  assert.deepEqual(decide(access, 'order.read', { ...mall, id: 'mall:b' }, { expectedAccessVersion: 7, now }), { allowed: false, reason: 'SCOPE_DENIED' });
  assert.deepEqual(decide(access, 'order.read', { ...mall, tenant: 'tenant:b' }, { expectedAccessVersion: 7, now }), { allowed: false, reason: 'SCOPE_DENIED' });
  assert.deepEqual(decide(access, 'order.read', mall, { expectedAccessVersion: 8, now }), { allowed: false, reason: 'ACCESS_VERSION_STALE' });
  assert.deepEqual(decide({ ...access, permissions: { ...access.permissions, denies: new Set(['order.read']) } }, 'order.read', mall, { expectedAccessVersion: 7, now }), { allowed: false, reason: 'EXPLICIT_DENY' });
  assert.deepEqual(decide({ ...access, scopes: [...access.scopes, { effect: 'deny', scope: mall, effective: '2026-01-01T00:00:00.000Z', expires: null }] }, 'order.read', mall, { expectedAccessVersion: 7, now }), {
    allowed: false,
    reason: 'SCOPE_DENIED',
  });
});

test('critical refunds and exports require recent step-up evidence', () => {
  assert.equal(checkAssurance('payment.refund', { now }), 'STEPUP_REQUIRED');
  assert.equal(checkAssurance('finance.statement.export', { now }), 'STEPUP_REQUIRED');
  assert.equal(checkAssurance('payment.refund', { now, stepupAt: new Date('2026-08-20T23:59:00.000Z') }), null);
});
