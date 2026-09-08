import { describe, expect, it } from 'vitest';
import { mapQuote } from './infrastructure/CheckoutMapper';
import { checkoutState } from './application/CheckoutState';
import { checkoutDraft } from './model/CheckoutDraft';

describe('checkout mapping', () => {
  it('keeps the signed selected-line quote identity', () => {
    const quote = mapQuote({
      checkoutId: 'checkout:1',
      quoteId: 'quote:1',
      quoteVersion: 0,
      confirmationToken: 'a'.repeat(43),
      evidenceHash: 'b'.repeat(64),
      expiresAt: '2026-08-31T00:00:00Z',
      selection: selection(),
      cartVersion: 3,
      lines: [{ listing: 'listing:1', quantity: 2, payableMinor: 200, accepted: true, reasons: [], versions: { cartLine: 4 } }],
      subtotalMinor: 200,
      discountMinor: 0,
      shippingMinor: 0,
      taxMinor: 0,
      payableMinor: 200,
      benefitMinor: 100,
      personalMinor: 100,
      currency: 'CNY',
      tenders: [],
      rejections: [],
    });
    expect(quote).toMatchObject({ quoteId: 'quote:1', cartVersion: 3, lines: [{ versions: { cartLine: 4 } }] });
  });

  it('requires a fresh one-time confirmation token after restoring a current quote', () => {
    const draft = checkoutDraft({ cartVersion: 3, lines: selection().lines, addressId: 'address:1', voucherIds: ['voucher:1'], benefits: [{ accountId: 'benefitaccount:1', amountMinor: 100 }] });
    const quote = mapQuote(value({ confirmationToken: null }));
    expect(checkoutState({ draft, quote, loading: false, failed: false, quoting: false, committing: false, now: Date.parse('2026-08-30T00:00:00Z') })).toMatchObject({ phase: 'recovered', canQuote: true, canCommit: false });
  });

  it('withdraws an old amount as soon as checkout selection changes', () => {
    const draft = checkoutDraft({ cartVersion: 3, lines: selection().lines, addressId: 'address:2', voucherIds: ['voucher:1'], benefits: [{ accountId: 'benefitaccount:1', amountMinor: 100 }] });
    const state = checkoutState({ draft, quote: mapQuote(value()), loading: false, failed: false, quoting: false, committing: false, now: Date.parse('2026-08-30T00:00:00Z') });
    expect(state).toMatchObject({ phase: 'stale', quote: null, canQuote: true, canCommit: false });
  });
});

function selection() {
  return { cartVersion: 3, lines: [{ listingId: 'listing:1', quantity: 2, lineVersion: 4 }], addressId: 'address:1', invoiceId: null, delivery: { method: 'standard' as const, note: null, scheduledAt: null }, voucherIds: ['voucher:1'], benefits: [{ accountId: 'benefitaccount:1', amountMinor: 100 }], paymentScene: 'jsapi' as const };
}

function value(overrides: Readonly<Record<string, unknown>> = {}) {
  return {
    checkoutId: 'checkout:1', quoteId: 'quote:1', quoteVersion: 0, confirmationToken: 'a'.repeat(43), evidenceHash: 'b'.repeat(64), expiresAt: '2026-08-31T00:00:00Z', selection: selection(), cartVersion: 3,
    lines: [{ listing: 'listing:1', quantity: 2, payableMinor: 200, accepted: true, reasons: [], versions: { cartLine: 4 } }], subtotalMinor: 200, discountMinor: 0, shippingMinor: 0, taxMinor: 0, payableMinor: 200, benefitMinor: 100, personalMinor: 100, currency: 'CNY', tenders: [], rejections: [], ...overrides,
  };
}
