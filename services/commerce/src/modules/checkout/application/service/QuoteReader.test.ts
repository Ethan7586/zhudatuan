import { describe, expect, it, vi } from 'vitest';
import type { ReadTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import { CheckoutPolicy } from '../../domain/policy/CheckoutPolicy';
import { QuoteDependencyCall } from './QuoteDependencyCall';
import { QuoteReader } from './QuoteReader';

describe('QuoteReader', () => {
  it('starts catalog, pricing and inventory together and freezes every checkout dependency snapshot', async () => {
    const catalog = deferred<readonly Record<string, unknown>[]>();
    const pricing = deferred<readonly Record<string, unknown>[]>();
    const inventory = deferred<readonly Record<string, unknown>[]>();
    const starts: string[] = [];
    const address = {
      id: 'address:one',
      regionCode: '310000',
      version: 3,
      recipientCiphertext: 'kms:recipient',
      mobileCiphertext: 'kms:mobile',
      addressCiphertext: 'kms:address',
      recipientMasked: '王**',
      mobileMasked: '138****0000',
      addressMasked: '上海市***',
      isDefault: true,
    };
    const reader = new QuoteReader(
      {
        access: { profile: async () => ({ member: 'member:one', organization: 'mall:one', status: 'active' }) } as never,
        address: { snapshot: async () => address },
        benefit: { preview: async () => [] },
        cart: { current: async () => ({ id: 'cart:one', application: 'app:one', version: 2, items: [{ listing: 'listing:one', sku: 'sku:one', quantity: 2, selected: true, version: 1 }] }) } as never,
        catalog: { items: () => { starts.push('catalog'); return catalog.promise as never; } },
        experience: { published: async () => ({ version: 'release:one', hash: 'releasehash' }) },
        invoice: { snapshot: async () => null } as never,
        inventory: { availability: () => { starts.push('inventory'); return inventory.promise as never; } } as never,
        marketing: { evaluate: async () => ({ amountMinor: 10, evidence: [{ id: 'campaign:one', version: 2, discount: 10 }] }) },
        orders: { purchases: async () => [] } as never,
        pricing: { offers: () => { starts.push('pricing'); return pricing.promise as never; } } as never,
        qualification: { profile: async () => ({ status: 'active', version: 4, city: '310000' }), policies: async () => [], tags: async () => ['employee'] },
        risk: { evaluate: async () => ({ outcome: 'allow', safeReason: '通过', decision: 'risk:one' }) },
        voucher: { preview: async () => [] },
      },
      new CheckoutPolicy(900),
      new QuoteDependencyCall(1_000)
    );
    const reading = reader.read({} as ReadTransactionContext, 'membership:one', selection(), control());
    await vi.waitFor(() => expect(starts).toEqual(expect.arrayContaining(['catalog', 'pricing', 'inventory'])));
    catalog.resolve([{ listing: 'listing:one', sku: 'sku:one', title: '实体福利', listingVersion: 5, listingStatus: 'published', product: 'product:one', productType: 'physical', category: 'category:one', productVersion: 6, skuVersion: 7, provider: null, partner: null }]);
    pricing.resolve([{ sku: 'sku:one', amountMinor: 100, compareMinor: null, currency: 'CNY', version: 'price:8', breakdown: [], watermark: 'pricewatermark' }]);
    inventory.resolve([{ sku: 'sku:one', stockitem: 'stock:one', onhand: 20, safety: 2, reserved: 3, version: 9 }]);
    const quote = await reading;
    expect(quote).toMatchObject({ subtotalMinor: 200, discountMinor: 10, shippingMinor: 0, taxMinor: 0, payableMinor: 190, address: { value: address, version: '3' }, shipping: { method: 'standard' }, tax: { mode: 'included' } });
    expect(quote.evidence).toMatchObject({ catalog: [{ listingVersion: 5 }], pricing: [{ version: 'price:8' }], inventory: [{ version: 9 }], qualification: [], marketing: [{ id: 'campaign:one', version: 2 }], risk: { outcome: 'allow' } });
  });
});

function selection() {
  return { cartVersion: 2, lines: [{ listingId: 'listing:one', quantity: 2, lineVersion: 1 }], addressId: 'address:one', invoiceId: null, delivery: { method: 'standard' as const, note: null, scheduledAt: null }, voucherIds: [], benefits: [], paymentScene: 'jsapi' as const };
}

function control() {
  return { expiresAt: Date.now() + 2_000, signal: new AbortController().signal, actor: 'principal:one', operation: 'checkout.quote.create' as const, trace: 'trace:one', scopes: ['mall:one'] };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
