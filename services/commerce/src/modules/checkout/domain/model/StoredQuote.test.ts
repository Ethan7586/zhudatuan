import { describe, expect, it } from 'vitest';
import { storedQuote } from './StoredQuote';

describe('storedQuote', () => {
  it('restores required product image evidence without dropping it', () => {
    const quote = snapshot();
    expect(storedQuote(quote).lines[0]).toMatchObject({ imageReference: 'object:catalog:gift', imageUrl: null });
    expect(() => storedQuote({ ...quote, lines: [{ ...quote.lines[0], imageReference: undefined }] })).toThrow('QUOTE_PAYLOAD_INVALID');
  });
});

function snapshot() {
  return {
    cart: { id: 'cart:one', member: 'member:one', mall: 'mall:one', application: 'app:one', version: 2 },
    selection: {},
    lines: [
      {
        listing: 'listing:one',
        sku: 'sku:one',
        product: 'product:one',
        productType: 'digital',
        category: 'category:one',
        title: '测试商品',
        imageReference: 'object:catalog:gift',
        imageUrl: null,
        quantity: 1,
        unitMinor: 100,
        totalMinor: 100,
        discountMinor: 0,
        payableMinor: 100,
        provider: null,
        partner: null,
        stockitem: null,
        versions: {},
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
    tenders: [],
    address: null,
    invoice: null,
    shipping: { method: 'digital', amountMinor: 0, version: 'shipping:digital:1' },
    tax: { mode: 'included', amountMinor: 0, version: 'tax:included:1' },
    evidence: {},
    rejections: [],
  };
}
