import { describe, expect, it, vi } from 'vitest';
import type { OperationRequest } from '../../foundation/application/OperationExecution';
import { ReadMemberships } from './application/query/ReadMemberships';
import { SwitchMembership } from './application/command/SwitchMembership';

describe('storefront membership switching', () => {
  it('lists only active memberships returned by the owning ports', async () => {
    const action = new ReadMemberships(
      { memberForPrincipal: vi.fn(async () => 'member:one') } as never,
      { memberships: vi.fn(async () => [{ id: 'membership:one', target: 'storefront', organization: 'mall:one', accessVersion: 4 }]) } as never,
      { names: vi.fn(async () => [{ id: 'mall:one', name: '福利商城' }]) } as never
    ).action();
    await expect(action(request('identity.memberships.read'), {} as never)).resolves.toMatchObject({
      body: { items: [{ id: 'membership:one', organizationId: 'mall:one', name: '福利商城', current: true, accessVersion: 4 }], count: 1 },
    });
  });

  it('revokes the old session and rotates cookies only after ownership validation', async () => {
    const revokeCurrent = vi.fn(async () => ({ id: 'session:old', revokedAt: new Date() }));
    const issue = vi.fn(async () => ({ session: 'session:new', membership: 'membership:two', target: 'storefront' as const, expiresin: 3600, headers: { 'set-cookie': 'rotated' } }));
    const publish = vi.fn(async () => undefined);
    const action = new SwitchMembership(
      { memberForPrincipal: vi.fn(async () => 'member:one') } as never,
      { memberships: vi.fn(async () => [{ id: 'membership:two', target: 'storefront', organization: 'mall:two', accessVersion: 1 }]) } as never,
      { issue },
      { revokeCurrent } as never,
      { publish }
    ).action();
    const result = await action(request('identity.memberships.switch', { membershipId: 'membership:two' }), {} as never);
    expect(revokeCurrent).toHaveBeenCalledWith(expect.anything(), 'principal:one', 'session:old');
    expect(issue).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ membership: 'membership:two', principal: 'principal:one' }));
    expect(publish).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ status: 200, headers: { 'set-cookie': 'rotated' }, body: { membership: 'membership:two', session: 'session:new' } });
  });
});

function request(type: OperationRequest['type'], body?: Readonly<Record<string, unknown>>): OperationRequest {
  return {
    type,
    input: {
      path: {},
      query: {},
      headers: { 'x-peer-address': '127.0.0.1', 'user-agent': 'test', 'x-device-id': 'device:one', 'x-trace-id': 'trace:one' },
      body,
      rawBody: '',
      idempotency: 'switch:one',
      deadline: Date.now() + 1000,
      signal: new AbortController().signal,
    },
    security: {
      kind: 'session',
      access: {
        actor: { id: 'principal:one', session: 'session:old', membership: 'membership:one', credentialVersion: 1, accessVersion: 3, target: 'storefront', assurance: { level: 2 } },
        membership: { id: 'membership:one', active: true, accessVersion: 3, permissions: { allows: new Set(['identity.session.read', 'identity.session.manage']), denies: new Set() }, scopes: [] },
        organization: 'mall:one',
        scope: { id: 'self:principal:one', kind: 'self', path: [] },
        accessVersion: 3,
        capabilities: new Set(['identity.memberships.read', 'identity.memberships.switch']),
        capabilityVersion: 1,
        assurance: { level: 2 },
        trace: 'trace:one',
      },
    },
  };
}
