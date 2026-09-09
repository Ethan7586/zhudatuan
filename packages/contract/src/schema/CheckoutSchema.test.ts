import { describe, expect, it } from 'vitest';
import { CHECKOUT_OUTPUT_SCHEMAS } from './CheckoutSchema';

describe('checkout output schemas', () => {
  it('preserves immutable product image evidence on every quote line', () => {
    const quote = output();
    expect(CHECKOUT_OUTPUT_SCHEMAS.CheckoutQuoteCreateOutput.parse(quote)).toEqual(quote);
    expect(() =>
      CHECKOUT_OUTPUT_SCHEMAS.CheckoutQuoteCreateOutput.parse({
        ...quote,
        lines: [{ ...quote.lines[0], imageReference: undefined }],
      })
    ).toThrow();
  });
});

function output() {
  return {
    checkoutId: 'checkout:one',
    quoteId: 'quote:one',
    quoteVersion: 1,
    confirmationToken: 'a'.repeat(43),
    evidenceHash: 'b'.repeat(64),
    expiresAt: '2026-09-10T10:15:00.000Z',
    selection: {
      cartVersion: 2,
      lines: [{ listingId: 'listing:one', quantity: 1, lineVersion: 0 }],
      addressId: null,
      invoiceId: null,
      delivery: { method: 'digital' as const, note: null, scheduledAt: null },
      voucherIds: [],
      benefits: [],
      paymentScene: 'jsapi' as const,
    },
    cartVersion: 2,
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
        versions: { listing: 1, product: 1, sku: 1 },
        accepted: true,
        reasons: [],
      },
    ],
    evidence: {},
    subtotalMinor: 100,
    discountMinor: 0,
    shippingMinor: 0,
    taxMinor: 0,
    payableMinor: 100,
    benefitMinor: 0,
    personalMinor: 100,
    currency: 'CNY' as const,
    tenders: [{ kind: 'wechat' as const, reference: null, amountMinor: 100 }],
    rejections: [],
  };
}
