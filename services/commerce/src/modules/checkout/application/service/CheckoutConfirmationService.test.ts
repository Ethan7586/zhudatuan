import { describe, expect, it, vi } from 'vitest';
import type { OperationRequest } from '../../../../foundation/application/OperationRequest';
import { CheckoutConfirmationService } from '../../infrastructure/persistence/CheckoutConfirmationService';
import { result, withWriteTransaction } from '../../../../test/TransactionFixture';

describe('CheckoutConfirmationService', () => {
  it('resolves an owner resource scope through its organization boundary', async () => {
    const profile = vi.fn().mockResolvedValue({ member: 'member:one', organization: 'mall:one' });
    const lockQuote = vi.fn().mockRejectedValue(new Error('STOP_AFTER_SCOPE_ASSERTION'));
    const scope = vi.fn().mockResolvedValue({
      id: 'tenant:one',
      scopeKind: 'tenant',
      timezone: 'Asia/Shanghai',
      tenant: 'tenant:one',
      ancestors: [],
      descendants: ['tenant:one', 'mall:one'],
    });
    const usecase = new CheckoutConfirmationService(
      {} as never,
      { profile } as never,
      { lockQuote } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { scope } as never,
      {} as never,
      {} as never
    );

    await expect(
      withWriteTransaction(
        async () => result([]),
        (transaction) => usecase.execute(request(), transaction)
      )
    ).rejects.toThrow('STOP_AFTER_SCOPE_ASSERTION');
    expect(scope).toHaveBeenCalledWith(expect.anything(), 'mall:one');
  });

  it('keeps a committed order recoverable when its WeChat identity is not bound', async () => {
    const payment = { continue: vi.fn().mockRejectedValue(new Error('WECHAT_IDENTITY_REQUIRED')) };
    const usecase = new CheckoutConfirmationService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      payment as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never
    );
    const expiresAt = new Date(Date.now() + 60_000).toISOString();

    const result = await usecase.finalize(request(), {
      status: 201,
      body: {
        order: { id: 'order:one' },
        payment: { paymentId: 'intent:one', state: 'preparing', expiresAt },
      },
    });

    expect(result.body).toMatchObject({
      order: { id: 'order:one' },
      payment: { paymentId: 'intent:one', state: 'recovery', retryAfter: 5 },
    });
  });
});

function request(): OperationRequest {
  return {
    type: 'order.orders.create',
    input: {
      path: {},
      query: {},
      headers: {},
      body: { quoteId: 'quote:one', paymentScene: 'jsapi' },
      rawBody: '',
      deadline: Date.now() + 1_000,
      signal: new AbortController().signal,
      idempotency: 'checkout-regression',
    },
    security: {
      kind: 'session',
      access: {
        actor: { id: 'principal:one', session: 'session:one', membership: 'membership:one', credentialVersion: 1, accessVersion: 1, target: 'storefront', assurance: { level: 3, verified: new Date() } },
        membership: { id: 'membership:one', active: true, accessVersion: 1, permissions: { allows: new Set(['order.create']), denies: new Set() }, scopes: [] },
        organization: 'mall:one',
        scope: { id: 'member:one', kind: 'owner', tenant: 'tenant:one', path: [] },
        accessVersion: 1,
        capabilities: new Set(['order.orders.create']),
        capabilityVersion: 1,
        assurance: { level: 3, verified: new Date() },
        trace: 'trace:checkout',
      },
    },
  };
}
