import type { CheckoutQuote } from '../../domain/model/CheckoutQuote';
import type { StoredCurrentQuote } from '../port/CheckoutSessionStore';
import { quoteHash } from '../../domain/service/QuoteSigner';

export function quoteResult(stored: StoredCurrentQuote, quote: CheckoutQuote, confirmationToken: string | null) {
  const benefitMinor = quote.tenders.filter(({ kind }) => kind === 'benefit').reduce((sum, tender) => sum + tender.amountMinor, 0);
  return Object.freeze({
    checkoutId: stored.checkoutId,
    quoteId: stored.quoteId,
    quoteVersion: stored.quoteVersion,
    confirmationToken,
    evidenceHash: quoteHash(quote.evidence),
    expiresAt: stored.expiresAt,
    cartVersion: quote.cart.version,
    lines: quote.lines,
    evidence: quote.evidence,
    subtotalMinor: quote.subtotalMinor,
    discountMinor: quote.discountMinor,
    shippingMinor: quote.shippingMinor,
    taxMinor: quote.taxMinor,
    payableMinor: quote.payableMinor,
    benefitMinor,
    personalMinor: quote.personalMinor,
    currency: quote.currency,
    tenders: quote.tenders,
    rejections: quote.rejections,
  });
}
