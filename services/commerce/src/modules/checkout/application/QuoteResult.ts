import type { CheckoutQuote } from '../domain/model/CheckoutQuote';
import type { StoredCurrentQuote } from './port/CheckoutRepository';

export function quoteResult(stored: StoredCurrentQuote, quote: CheckoutQuote) {
  const benefitMinor = quote.tenders.filter(({ kind }) => kind === 'benefit').reduce((sum, tender) => sum + tender.amountMinor, 0);
  return Object.freeze({
    checkoutId: stored.checkoutId,
    quoteId: stored.quoteId,
    quoteVersion: stored.quoteVersion,
    signature: stored.signature,
    expiresAt: stored.expiresAt,
    cartVersion: quote.cart.version,
    lines: quote.lines,
    evidence: quote.evidence,
    subtotalMinor: quote.subtotalMinor,
    discountMinor: quote.discountMinor,
    shippingMinor: 0,
    payableMinor: quote.payableMinor,
    benefitMinor,
    personalMinor: quote.personalMinor,
    currency: quote.currency,
    tenders: quote.tenders,
    rejections: quote.rejections,
  });
}
