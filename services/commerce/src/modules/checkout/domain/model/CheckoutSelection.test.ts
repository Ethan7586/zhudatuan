import { describe, expect, it } from 'vitest';
import { checkoutSelection } from './CheckoutSelection';

describe('checkoutSelection', () => {
  const base = {
    cartVersion: 3,
    lines: [
      { listingId: 'listing:b', quantity: 2, lineVersion: 4 },
      { listingId: 'listing:a', quantity: 1, lineVersion: 2 },
    ],
    delivery: {},
    voucherIds: [],
    benefits: [],
    paymentScene: 'jsapi',
  } as const;

  it('keeps only explicit selected lines and sorts their lock identity', () => {
    expect(checkoutSelection(base).lines).toEqual([
      { listingId: 'listing:a', quantity: 1, lineVersion: 2 },
      { listingId: 'listing:b', quantity: 2, lineVersion: 4 },
    ]);
  });

  it('rejects empty or duplicate selected lines', () => {
    expect(() => checkoutSelection({ ...base, lines: [] })).toThrow();
    expect(() => checkoutSelection({ ...base, lines: [base.lines[0], base.lines[0]] })).toThrow();
  });

  it('rejects zero quantities and invalid payment scenes', () => {
    expect(() => checkoutSelection({ ...base, lines: [{ listingId: 'listing:a', quantity: 0, lineVersion: 1 }] })).toThrow();
    expect(() => checkoutSelection({ ...base, paymentScene: 'native' })).toThrow();
  });

  it('normalizes delivery choices and rejects undeclared client pricing fields', () => {
    expect(checkoutSelection(base).delivery).toEqual({ method: 'standard', note: null, scheduledAt: null });
    expect(() => checkoutSelection({ ...base, delivery: { shippingMinor: 1 } })).toThrow('VALIDATION_FAILED');
  });
});
