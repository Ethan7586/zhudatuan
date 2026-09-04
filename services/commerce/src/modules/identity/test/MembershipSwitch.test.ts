import { describe, expect, it, vi } from 'vitest';
import type { OperationRequest } from '../../../foundation/application/OperationRequest';
import { ReadMemberships } from '../application/service/ReadMemberships';
import { SwitchMembership } from '../application/service/SwitchMembership';
import { result, withWriteTransaction } from '../../../test/TransactionFixture';

describe('storefront membership switching', () => {
  it('lists only active memberships returned by the owning ports', async () => {
    const action = new ReadMemberships({ memberForPrincipal: vi.fn(async () => 'member:one') } as never, { memberships: vi.fn(async () => [membership('membership:one', 4)]) } as never).action();
    await expect(action(request('identity.memberships.read'), {} as never)).resolves.toMatchObject({
      body: { items: [{ id: 'membership:one', organizationName: '福利商城', roleLabel: '普通成员', current: true, accessVersion: 4 }], count: 1 },
    });
  });

  it('revokes the old session and rotates cookies only after ownership validation', async () => {
    const revokeCurrent = vi.fn(async () => ({ id: 'session:old', revokedAt: new Date() }));
    const issue = vi.fn(async () => ({ session: 'session:new', membership: 'membership:two', target: 'storefront' as const, expiresin: 3600, headers: { 'set-cookie': 'rotated' } }));
    const publish = vi.fn(async () => undefined);
    const action = new SwitchMembership({ memberForPrincipal: vi.fn(async () => 'member:one') } as never, { memberships: vi.fn(async () => [membership('membership:two', 1)]) } as never, { issue }, { revokeCurrent } as never, {
      publish,
    }).action();
    const switched = await withWriteTransaction(
      async () => result([]),
      (transaction) => action(request('identity.memberships.switch', { membershipId: 'membership:two' }), transaction)
    );
    expect(revokeCurrent).toHaveBeenCalledWith(expect.anything(), 'principal:one', 'session:old');
    expect(issue).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ membership: 'membership:two', principal: 'principal:one' }));
    expect(publish).toHaveBeenCalledTimes(2);
    expect(switched).toMatchObject({ status: 200, headers: { 'set-cookie': 'rotated' }, body: { membership: 'membership:two', session: 'session:new' } });
  });

  it('keeps the active surface and binds the replacement session to the refreshed access version', async () => {
    const memberships = vi.fn(async () => [{ ...membership('membership:store', 11), target: 'store' as const }]);
    const issue = vi.fn(async () => ({ session: 'session:new', membership: 'membership:store', target: 'store' as const, expiresin: 3600, headers: { 'set-cookie': 'store-rotated' } }));
    const action = new SwitchMembership(
      { memberForPrincipal: vi.fn(async () => 'member:one') } as never,
      { memberships } as never,
      { issue },
      { revokeCurrent: vi.fn(async () => ({ id: 'session:old', revokedAt: new Date() })) } as never,
      { publish: vi.fn(async () => undefined) }
    ).action();
    const storeRequest = request('identity.memberships.switch', { membershipId: 'membership:store' });
    const security = storeRequest.security.kind === 'session'
      ? { ...storeRequest.security, access: { ...storeRequest.security.access, actor: { ...storeRequest.security.access.actor, target: 'store' as const } } }
      : storeRequest.security;

    await withWriteTransaction(async () => result([]), (transaction) => action({ ...storeRequest, security }, transaction));

    expect(memberships).toHaveBeenCalledWith(expect.anything(), 'member:one', 'store');
    expect(issue).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ target: 'store', expectedAccessVersion: 11 }));
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
        roles: [],
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

function membership(id: string, accessVersion: number) {
  return Object.freeze({
    id,
    target: 'storefront' as const,
    organization: 'mall:one',
    accessVersion,
    displayName: '张三',
    organizationName: '福利商城',
    scopeKind: 'mall',
    scopeId: 'mall:one',
    roleLabel: '普通成员',
    logoUrl: null,
  });
}
