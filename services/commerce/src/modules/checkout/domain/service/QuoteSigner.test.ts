import { describe, expect, it } from 'vitest';
import { QuoteSigner, quoteHash } from './QuoteSigner';

describe('QuoteSigner', () => {
  it('signs canonical content independently of object property order', () => {
    const signer = new QuoteSigner('checkout-test-key-that-is-at-least-thirty-two-bytes');
    const left = { amount: 100, versions: { cart: 1, price: 2 } };
    const right = { versions: { price: 2, cart: 1 }, amount: 100 };
    expect(signer.sign(left)).toBe(signer.sign(right));
    expect(quoteHash(left)).toBe(quoteHash(right));
  });

  it('fails closed for payload or signature tampering', () => {
    const signer = new QuoteSigner('checkout-test-key-that-is-at-least-thirty-two-bytes');
    const quote = { payableMinor: 100 };
    const signature = signer.sign(quote);
    expect(signer.verify(quote, signature)).toBe(true);
    expect(signer.verify({ payableMinor: 101 }, signature)).toBe(false);
    expect(signer.verify(quote, 'not-a-signature')).toBe(false);
  });
});
