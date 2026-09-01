import type { CheckoutQuote } from '../checkout/domain/model/CheckoutQuote';

export interface InternalIntent {
  readonly amount_minor: number;
  readonly currency: string;
  readonly intent: string;
  readonly mall_id: string;
  readonly member_id: string;
  readonly order_id: string;
  readonly scope_id: string;
  readonly state: string;
  readonly tender_count: number;
  readonly tender_total: number;
  readonly unsupported_tenders: number;
}

export function assertPurchaseAssurance(level: number): void {
  if (level < 2) throw new Error('MOBILE_ASSURANCE_REQUIRED');
}

export function assertPurchaseTarget(target: string): void {
  if (target !== 'storefront') throw new Error('PURCHASE_AUDIENCE_TARGET_MISMATCH');
}

export function assertInternalBenefitQuote(quote: CheckoutQuote): void {
  if (quote.rejections.length > 0) throw new Error('CHECKOUT_REJECTED');
  if (!Number.isSafeInteger(quote.payableMinor) || quote.payableMinor <= 0) throw new Error('INTERNAL_PAYMENT_AMOUNT_INVALID');
  if (quote.personalMinor !== 0) throw new Error('PAYMENT_EXTERNAL_TENDER_FORBIDDEN');
  if (quote.tenders.length === 0 || quote.tenders.some(({ kind, reference, amountMinor }) =>
    kind !== 'benefit' || reference === null || !Number.isSafeInteger(amountMinor) || amountMinor <= 0)) {
    throw new Error('PAYMENT_INTERNAL_BENEFIT_ONLY');
  }
  if (quote.tenders.reduce((total, tender) => total + tender.amountMinor, 0) !== quote.payableMinor) {
    throw new Error('PAYMENT_TENDER_SUM_MISMATCH');
  }
}

export function assertInternalIntent(intent: InternalIntent | undefined): asserts intent is InternalIntent {
  if (!intent || !['created', 'authorizing', 'authorized'].includes(intent.state)) throw new Error('PAYMENT_INTENT_NOT_PAYABLE');
  if (intent.currency !== 'CNY' || !Number.isSafeInteger(intent.amount_minor) || intent.amount_minor <= 0) {
    throw new Error('INTERNAL_PAYMENT_AMOUNT_INVALID');
  }
  if (intent.tender_count <= 0 || intent.unsupported_tenders !== 0) throw new Error('PAYMENT_EXTERNAL_TENDER_FORBIDDEN');
  if (intent.tender_total !== intent.amount_minor) throw new Error('PAYMENT_TENDER_SUM_MISMATCH');
}
