import { describe, expect, it } from 'vitest';
import type { CheckoutQuote } from '../model/CheckoutQuote';
import { ConfirmQuotePolicy } from './ConfirmQuotePolicy';

describe('ConfirmQuotePolicy', () => {
  it('accepts the original unexpired quote context', () => {
    const quote = fixture();
    expect(() => new ConfirmQuotePolicy().assertCurrent(quote, quote, future())).not.toThrow();
  });

  it('rejects expired, cart-drifted and dependency-drifted quote contexts', () => {
    const quote = fixture();
    expect(() => new ConfirmQuotePolicy().assertCurrent(quote, quote, '2020-01-01T00:00:00.000Z')).toThrow('PRICE_QUOTE_EXPIRED');
    expect(() => new ConfirmQuotePolicy().assertCurrent(quote, { ...quote, cart: { ...quote.cart, version: 3 } }, future())).toThrow('PRICE_QUOTE_EXPIRED');
    expect(() => new ConfirmQuotePolicy().assertCurrent(quote, { ...quote, evidence: { ...quote.evidence, experience: { version: 'release:2' } } }, future())).toThrow('PRICE_QUOTE_EXPIRED');
  });

  it('uses the configured price drift threshold while keeping structural versions exact', () => {
    const quote = fixture();
    const within = { ...quote, payableMinor: 103, lines: [{ ...quote.lines[0]!, unitMinor: 103, totalMinor: 103, payableMinor: 103, versions: { ...quote.lines[0]!.versions, price: 'price:2' } }] };
    expect(() => new ConfirmQuotePolicy(3).assertCurrent(quote, within, future())).not.toThrow();
    expect(() => new ConfirmQuotePolicy(2).assertCurrent(quote, within, future())).toThrow('PRICE_QUOTE_EXPIRED');
    const stockDrift = { ...within, lines: [{ ...within.lines[0]!, versions: { ...within.lines[0]!.versions, stock: 2 } }] };
    expect(() => new ConfirmQuotePolicy(10).assertCurrent(quote, stockDrift, future())).toThrow('PRICE_QUOTE_EXPIRED');
  });
});

function fixture(): CheckoutQuote {
  const shipping = { method: 'digital' as const, amountMinor: 0, version: 'shipping:digital:1' };
  const tax = { mode: 'included' as const, amountMinor: 0, version: 'tax:included:1' };
  return {
    cart: { id: 'cart:one', member: 'member:one', mall: 'mall:one', application: 'app:one', version: 2 },
    selection: {
      cartVersion: 2,
      lines: [{ listingId: 'listing:one', quantity: 1, lineVersion: 0 }],
      addressId: null,
      invoiceId: null,
      delivery: { method: 'digital', note: null, scheduledAt: null },
      voucherIds: [],
      benefits: [],
      paymentScene: 'jsapi',
    },
    lines: [
      {
        listing: 'listing:one',
        sku: 'sku:one',
        product: 'product:one',
        productType: 'digital',
        category: 'category:one',
        title: '商品',
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
        versions: { cartLine: 0, listing: 1, product: 1, sku: 1, price: 'price:1', stock: 1 },
        accepted: true,
        reasons: [],
      },
    ],
    subtotalMinor: 100,
    discountMinor: 0,
    shippingMinor: 0,
    taxMinor: 0,
    payableMinor: 100,
    personalMinor: 100,
    currency: 'CNY',
    tenders: [{ kind: 'wechat', reference: null, amountMinor: 100 }],
    address: null,
    invoice: null,
    shipping,
    tax,
    evidence: { cart: { version: 2 }, profile: { version: 1 }, address: null, invoice: null, experience: { version: 'release:1' }, qualification: [], marketing: [], vouchers: [], benefits: [], shipping, tax },
    rejections: [],
  };
}

function future(): string {
  return new Date(Date.now() + 60_000).toISOString();
}
