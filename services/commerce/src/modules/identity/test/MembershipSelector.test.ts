import { describe, expect, it, vi } from 'vitest';
import { AuthTransaction } from '../domain/model/AuthTransaction';
import { MembershipSelector } from '../application/service/MembershipSelector';
import { SessionCookieAdapter } from '../infrastructure/security/SessionCookie';
import { result, withWriteTransaction } from '../../../test/TransactionFixture';
import { RUNTIME_LIMITS } from '@shop/config/runtime';

describe('MembershipSelector', () => {
  it('binds a password selection to browser, device and PKCE and consumes it once', async () => {
    const returnTarget = 'signed-return-target';
    const create = vi.fn().mockResolvedValue({ id: 'selection-id', token: 'p'.repeat(64) });
    const consume = vi.fn().mockResolvedValue({
      id: 'selection-id',
      principal: 'principal-one',
      target: 'storefront',
      memberships: [membership('membership-one'), membership('membership-two')],
      expiresAt: new Date('2099-01-01T00:00:00.000Z'),
      transaction: null,
      returnTarget,
      assurance: 1,
      authorization: { stateHash: 'a'.repeat(64), nonceHash: 'b'.repeat(64), challenge: 'c'.repeat(43) },
    });
    const repository = { create, consume, read: vi.fn() };
    const issue = vi.fn().mockResolvedValue({ session: 'session-one', headers: { 'set-cookie': 'session-cookie' } });
    const resolve = vi.fn(async () => ({ url: 'https://yengze.press/s/mall-one/orders', proof: returnTarget, expiresAt: '2099-01-01T00:00:00.000Z', target: 'storefront' as const }));
    const selector = new MembershipSelector(
      repository as never,
      { issue } as never,
      { browser: () => Buffer.alloc(32, 1), device: () => Buffer.alloc(32, 2) } as never,
      { memberships: async () => [{ ...membership('membership-two'), organization: 'mall-one' }] } as never,
      { memberForPrincipal: async () => 'member-one' } as never,
      { complete: vi.fn() } as never,
      { resolve } as never,
      new SessionCookieAdapter(RUNTIME_LIMITS.authentication.session.ttlSeconds)
    );
    const authorization = AuthTransaction.start({ state: 's'.repeat(32), nonce: 'n'.repeat(32), challenge: 'c'.repeat(43) });

    const started = await withWriteTransaction(
      async () => result([]),
      (transaction) =>
        selector.begin(
          transaction,
          {
            principal: 'principal-one',
            target: 'storefront',
            assurance: 1,
            authorization,
            returnTarget,
            memberships: [membership('membership-one'), membership('membership-two')],
          },
          { peer: '127.0.0.1', agent: 'browser', device: 'device-one' }
        )
    );
    expect(started).toEqual({ id: 'selection-id', headers: { 'set-cookie': expect.stringContaining('__Host-preauth=') } });
    expect(create).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ principal: 'principal-one', assurance: 1, returnTarget, authorization: { stateHash: expect.stringMatching(/^[0-9a-f]{64}$/), nonceHash: expect.stringMatching(/^[0-9a-f]{64}$/), challenge: 'c'.repeat(43) } })
    );

    const completed = await withWriteTransaction(
      async () => result([]),
      (transaction) => selector.select(transaction, 'selection-id', 'membership-two', { peer: '127.0.0.1', agent: 'browser', device: 'device-one', trace: 'trace-one' })
    );
    expect(completed.destination).toBe('https://yengze.press/s/mall-one/orders');
    expect(issue).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ membership: 'membership-two', assurance: 1 }));
    expect(resolve).toHaveBeenCalledWith(expect.anything(), { target: 'storefront', returnTarget, organization: 'mall-one' });
  });
});

function membership(id: string) {
  return Object.freeze({
    id,
    target: 'storefront' as const,
    organization: 'mall-one',
    accessVersion: 1,
    displayName: '张三',
    organizationName: '福利商城',
    scopeKind: 'mall',
    scopeId: 'mall-one',
    roleLabel: '普通成员',
    logoUrl: null,
  });
}
