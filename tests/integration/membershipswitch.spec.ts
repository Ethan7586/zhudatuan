import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SwitchMembership } from '../../services/commerce/src/modules/identity/application/command/SwitchMembership';

test('membership switch rejects a membership owned by another member before session revocation', async () => {
  let revoked = false;
  const action = new SwitchMembership(
    { memberForPrincipal: async () => 'member:one' } as never,
    { memberships: async () => [{ id: 'membership:one', target: 'storefront', organization: 'mall:one', accessVersion: 1 }] } as never,
    {
      issue: async () => {
        throw new Error('SESSION_MUST_NOT_ROTATE');
      },
    } as never,
    {
      revokeCurrent: async () => {
        revoked = true;
        return null;
      },
    } as never,
    { publish: async () => undefined } as never
  ).action();
  await assert.rejects(action(request('membership:other'), {} as never), /MEMBERSHIP_SELECTION_REQUIRED/);
  assert.equal(revoked, false);
});

test('membership switch revokes, rotates and publishes both immutable events', async () => {
  const events: string[] = [];
  const action = new SwitchMembership(
    { memberForPrincipal: async () => 'member:one' } as never,
    { memberships: async () => [{ id: 'membership:two', target: 'storefront', organization: 'mall:two', accessVersion: 2 }] } as never,
    { issue: async () => ({ session: 'session:new', membership: 'membership:two', target: 'storefront', expiresin: 3_600, headers: { 'set-cookie': 'rotated' } }) } as never,
    { revokeCurrent: async () => ({ id: 'session:old', revokedAt: new Date() }) } as never,
    {
      publish: async (_database: unknown, type: string) => {
        events.push(type);
      },
    } as never
  ).action();
  const result = await action(request('membership:two'), {} as never);
  assert.equal(result.body && (result.body as Record<string, unknown>).session, 'session:new');
  assert.deepEqual(events, ['identity.session.revoked', 'identity.membership.switched']);
});

function request(target: string) {
  return {
    type: 'identity.memberships.switch',
    input: {
      path: {},
      query: {},
      headers: { 'x-peer-address': '127.0.0.1', 'user-agent': 'test', 'x-device-id': 'device:one', 'x-trace-id': 'trace:one' },
      body: { membershipId: target },
      rawBody: '',
      idempotency: 'switch:one',
      deadline: Date.now() + 1_000,
      signal: new AbortController().signal,
    },
    security: {
      kind: 'session',
      access: {
        actor: { id: 'principal:one', session: 'session:old', membership: 'membership:one', credentialVersion: 1, accessVersion: 1, target: 'storefront', assurance: { level: 2 } },
        membership: { id: 'membership:one', active: true, accessVersion: 1, permissions: { allows: new Set(), denies: new Set() }, scopes: [] },
        scope: { id: 'self:principal:one', kind: 'self', path: [] },
        accessVersion: 1,
        capabilities: new Set(),
        capabilityVersion: 1,
        assurance: { level: 2 },
        trace: 'trace:switch',
      },
    },
  } as never;
}
