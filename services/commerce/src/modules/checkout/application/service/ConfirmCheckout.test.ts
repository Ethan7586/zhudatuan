import { describe, expect, it, vi } from 'vitest';
import type { OperationRequest } from '../../../../pipeline/OperationRequest';
import { result, withWriteTransaction } from '../../../../test/TransactionFixture';
import type { CheckoutQuote } from '../../domain/model/CheckoutQuote';
import { ConfirmCheckout } from './ConfirmCheckout';

describe('checkout confirmation', () => {
  it('resolves an owner resource scope before loading the one-time quote', async () => {
    const profile = vi.fn().mockResolvedValue({ member: 'member:one', organization: 'mall:one' });
    const lockQuote = vi.fn().mockRejectedValue(new Error('STOP_AFTER_SCOPE_ASSERTION'));
    const scope = vi.fn().mockResolvedValue(scopeSnapshot());
    const usecase = service({ members: { profile }, session: { lockQuote }, organization: { scope } });

    await expect(
      withWriteTransaction(
        async () => result([]),
        (transaction) => usecase.execute(request(), transaction)
      )
    ).rejects.toThrow('STOP_AFTER_SCOPE_ASSERTION');
    expect(scope).toHaveBeenCalledWith(expect.anything(), 'mall:one');
    expect(lockQuote).toHaveBeenCalledWith(expect.anything(), 'quote:one', 'member:one', 'mall:one', expect.stringMatching(/^[0-9a-f]{64}$/));
  });

  it('keeps the original failure authoritative so the transaction manager can roll back every hold', async () => {
    const quote = frozenQuote();
    const reservations = {
      inventoryHold: vi.fn(),
      voucherHold: vi.fn(),
      marketingHold: vi.fn(),
      benefitHold: vi.fn(),
    };
    const usecase = service({
      checkout: { selection: () => quote.selection, restore: () => quote, read: async () => quote },
      members: { profile: async () => ({ member: 'member:one', organization: 'mall:one' }) },
      session: {
        lockQuote: async () => ({
          checkout: 'checkout:one',
          cartId: 'cart:one',
          memberId: 'member:one',
          mallId: 'mall:one',
          applicationId: 'app:one',
          quoteId: 'quote:one',
          quoteHash: 'signed',
          expiresAt: new Date(Date.now() + 60_000),
          input: quote.selection,
          version: 0,
        }),
      },
      pricing: { quote: async () => ({ id: 'quote:one', member: 'member:one', mall: 'mall:one', payload: quote, signature: 'signed' }) },
      cart: { lockActive: vi.fn() },
      reservations,
      orders: { create: vi.fn().mockRejectedValue(new Error('ORDER_WRITE_FAILED')) },
      organization: { scope: async () => scopeSnapshot() },
    });

    await expect(
      withWriteTransaction(
        async () => result([]),
        (transaction) => usecase.execute(request(), transaction)
      )
    ).rejects.toThrow('ORDER_WRITE_FAILED');
    expect(reservations.inventoryHold).toHaveBeenCalledOnce();
    expect(reservations.voucherHold).toHaveBeenCalledOnce();
    expect(reservations.marketingHold).toHaveBeenCalledOnce();
    expect(reservations.benefitHold).toHaveBeenCalledOnce();
  });

  it('keeps an inventory reservation failure intact for the transaction manager', async () => {
    const quote = frozenQuote();
    const failure = new Error('INVENTORY_FAULT_INJECTED');
    const orders = { create: vi.fn() };
    const usecase = service({
      checkout: { selection: () => quote.selection, restore: () => quote, read: async () => quote },
      members: { profile: async () => ({ member: 'member:one', organization: 'mall:one' }) },
      session: {
        lockQuote: async () => ({
          checkout: 'checkout:one',
          cartId: 'cart:one',
          memberId: 'member:one',
          mallId: 'mall:one',
          applicationId: 'app:one',
          quoteId: 'quote:one',
          quoteHash: 'signed',
          expiresAt: new Date(Date.now() + 60_000),
          input: quote.selection,
          version: 0,
        }),
      },
      pricing: { quote: async () => ({ id: 'quote:one', member: 'member:one', mall: 'mall:one', payload: quote, signature: 'signed' }) },
      cart: { lockActive: vi.fn() },
      reservations: { inventoryHold: vi.fn().mockRejectedValue(failure), voucherHold: vi.fn(), marketingHold: vi.fn(), benefitHold: vi.fn() },
      orders,
      organization: { scope: async () => scopeSnapshot() },
    });

    await expect(
      withWriteTransaction(
        async () => result([]),
        (transaction) => usecase.execute(request(), transaction)
      )
    ).rejects.toBe(failure);
    expect(orders.create).not.toHaveBeenCalled();
  });

  it('keeps a committed order recoverable when its WeChat identity is not bound', async () => {
    const payment = { continue: vi.fn().mockRejectedValue(new Error('WECHAT_IDENTITY_REQUIRED')) };
    const usecase = service({ payment });
    const expiresAt = new Date(Date.now() + 60_000).toISOString();
    const committed = await usecase.finalize(request(), { status: 201, body: { order: { id: 'order:one' }, payment: { paymentId: 'intent:one', state: 'preparing', expiresAt } } });
    expect(committed.body).toMatchObject({ order: { id: 'order:one' }, payment: { paymentId: 'intent:one', state: 'recovery', retryAfter: 5 } });
  });
});

function service(overrides: Readonly<Record<string, unknown>> = {}) {
  return new ConfirmCheckout(
    (overrides.checkout ?? {}) as never,
    (overrides.members ?? {}) as never,
    (overrides.session ?? {}) as never,
    (overrides.pricing ?? {}) as never,
    (overrides.cart ?? {}) as never,
    (overrides.reservations ?? {}) as never,
    (overrides.orders ?? {}) as never,
    (overrides.payment ?? {}) as never,
    (overrides.organization ?? {}) as never,
    (overrides.outbox ?? {}) as never
  );
}

function request(): OperationRequest {
  return {
    type: 'order.orders.create',
    input: {
      path: {},
      query: {},
      headers: {},
      body: { quoteId: 'quote:one', confirmationToken: 'a'.repeat(43), paymentScene: 'jsapi' },
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
        roles: [],
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

function scopeSnapshot() {
  return Object.freeze({ id: 'mall:one', scopeKind: 'mall', timezone: 'Asia/Shanghai', tenant: 'tenant:one', ancestors: ['tenant:one'], descendants: ['mall:one'] });
}

function frozenQuote(): CheckoutQuote {
  const selection = Object.freeze({
    cartVersion: 2,
    lines: Object.freeze([{ listingId: 'listing:one', quantity: 1, lineVersion: 0 }]),
    addressId: null,
    invoiceId: null,
    delivery: Object.freeze({ method: 'digital' as const, note: null, scheduledAt: null }),
    voucherIds: Object.freeze([]),
    benefits: Object.freeze([]),
    paymentScene: 'jsapi' as const,
  });
  const shipping = Object.freeze({ method: 'digital' as const, amountMinor: 0, version: 'shipping:digital:1' });
  const tax = Object.freeze({ mode: 'included' as const, amountMinor: 0, version: 'tax:included:1' });
  const evidence = Object.freeze({
    cart: { version: 2 },
    profile: { version: 1 },
    address: null,
    invoice: null,
    experience: { version: 'release:1', hash: 'hash' },
    qualification: [],
    marketing: [],
    vouchers: [],
    benefits: [],
    shipping,
    tax,
    risk: { outcome: 'allow', safeReason: '通过', decision: 'risk:one' },
  });
  return Object.freeze({
    cart: Object.freeze({ id: 'cart:one', member: 'member:one', mall: 'mall:one', application: 'app:one', version: 2 }),
    selection,
    lines: Object.freeze([
      {
        listing: 'listing:one',
        sku: 'sku:one',
        product: 'product:one',
        productType: 'digital',
        category: 'category:one',
        title: '测试商品',
        imageReference: null,
        imageUrl: '/products/gift.webp',
        quantity: 1,
        unitMinor: 100,
        totalMinor: 100,
        discountMinor: 0,
        payableMinor: 100,
        provider: null,
        partner: null,
        stockitem: 'stock:one',
        versions: Object.freeze({ cartLine: 0, listing: 1, product: 1, sku: 1, price: 'price:1', stock: 1 }),
        accepted: true,
        reasons: Object.freeze([]),
      },
    ]),
    subtotalMinor: 100,
    discountMinor: 0,
    shippingMinor: 0,
    taxMinor: 0,
    payableMinor: 100,
    personalMinor: 100,
    currency: 'CNY',
    tenders: Object.freeze([{ kind: 'wechat' as const, reference: null, amountMinor: 100 }]),
    address: null,
    invoice: null,
    shipping,
    tax,
    evidence,
    rejections: Object.freeze([]),
  });
}
