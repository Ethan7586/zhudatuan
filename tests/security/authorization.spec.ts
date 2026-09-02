import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkAssurance, decide, type MembershipAccess, type Scope } from '@shop/authz';
import { InvitationRatePolicy } from '../../services/commerce/src/modules/identity/domain/policy/InvitationRatePolicy';
import { PgInvitationRate } from '../../services/commerce/src/modules/identity/infrastructure/persistence/PgInvitationRate';
import { StreamCapacity } from '../../services/commerce/src/foundation/stream/StreamCapacity';
import { result, withWriteTransaction } from '../../services/commerce/src/test/TransactionFixture';

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

test('invitation resolution is throttled independently by code, device and network fingerprints', async () => {
  const rules = new InvitationRatePolicy().rules('storefront', { code: 'a'.repeat(64), device: 'b'.repeat(64), network: 'c'.repeat(64) });
  const failures = new Map<string, number>();
  const telemetry = { metrics: { count: () => undefined } };
  const limiter = new PgInvitationRate({} as never, telemetry as never);
  const input = { operation: 'identity.invitations.resolve', actor: `public:${'d'.repeat(64)}`, trace: 'trace:bruteforce', deadline: Date.now() + 10_000, signal: new AbortController().signal, rules };
  const attempt = () => withWriteTransaction(async (_sql, values) => {
    const key = `${values?.[0]}:${values?.[1]}`;
    const next = (failures.get(key) ?? 0) + 1;
    failures.set(key, next);
    return result([{ failures: next }]);
  }, (context) => limiter.consumeWithin(context, input));

  for (let index = 0; index < 12; index += 1) await assert.doesNotReject(attempt());
  await assert.rejects(attempt(), (cause: unknown) => cause instanceof Error && cause.message === 'RATE_LIMITED');
  assert.deepEqual(rules.map(({ maximum }) => maximum), [12, 60, 240]);
});

test('SSE admission limits both one scope and the complete process', () => {
  const capacity = new StreamCapacity(2, 1);
  const first = capacity.acquire(['mall:a']);
  assert.throws(() => capacity.acquire(['mall:a']), /RATE_LIMITED/);
  const second = capacity.acquire(['mall:b']);
  assert.throws(() => capacity.acquire(['mall:c']), /RATE_LIMITED/);
  first.release();
  second.release();
  assert.doesNotThrow(() => capacity.acquire(['mall:a']).release());
});
