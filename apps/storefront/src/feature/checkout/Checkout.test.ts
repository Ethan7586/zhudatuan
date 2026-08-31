import { describe, expect, it } from 'vitest';
import { mapQuote } from './infrastructure/CheckoutMapper';

describe('checkout mapping', () => {
  it('keeps the signed selected-line quote identity', () => {
    const quote = mapQuote({
      checkoutId: 'checkout:1',
      quoteId: 'quote:1',
      quoteVersion: 0,
      signature: 'a'.repeat(64),
      expiresAt: '2026-08-31T00:00:00Z',
      cartVersion: 3,
      lines: [{ listing: 'listing:1', quantity: 2, payableMinor: 200, accepted: true, reasons: [], versions: { cartLine: 4 } }],
      subtotalMinor: 200,
      discountMinor: 0,
      shippingMinor: 0,
      payableMinor: 200,
      benefitMinor: 100,
      personalMinor: 100,
      currency: 'CNY',
      tenders: [],
      rejections: [],
    });
    expect(quote).toMatchObject({ quoteId: 'quote:1', cartVersion: 3, lines: [{ versions: { cartLine: 4 } }] });
  });
});
