import { describe, expect, it } from 'vitest';
import type { CheckoutQuote } from '../checkout_jiesuan';
import { assertInternalBenefitQuote, assertInternalIntent, assertPurchaseAssurance, assertPurchaseQuote, assertPurchaseTarget } from './PurchasePolicy';

describe('purchase policy', () => {
  it('accepts internal, external, and mixed purchase quotes while rejecting unsupported tenders', () => {
    expect(() => assertPurchaseQuote(quote())).not.toThrow();
    expect(() => assertPurchaseQuote(quote({ personalMinor: 100,
      tenders: [{ kind: 'wechat', reference: null, amountMinor: 100 }] }))).not.toThrow();
    expect(() => assertPurchaseQuote(quote({ payableMinor: 150, personalMinor: 50,
      tenders: [{ kind: 'benefit', reference: 'account:one', amountMinor: 100 },
        { kind: 'wechat', reference: null, amountMinor: 50 }] }))).not.toThrow();
    expect(() => assertPurchaseQuote(quote({ tenders: [{ kind: 'voucher', reference: 'voucher:one', amountMinor: 100 }] })))
      .toThrow('PAYMENT_TENDER_UNSUPPORTED');
    expect(() => assertPurchaseQuote(quote({ personalMinor: 99,
      tenders: [{ kind: 'wechat', reference: null, amountMinor: 100 }] }))).toThrow('PAYMENT_EXTERNAL_AMOUNT_MISMATCH');
  });

  it('accepts only a positive, fully allocated benefit quote', () => {
    expect(() => assertInternalBenefitQuote(quote())).not.toThrow();
    expect(() => assertInternalBenefitQuote(quote({ personalMinor: 1 }))).toThrow('PAYMENT_EXTERNAL_TENDER_FORBIDDEN');
    expect(() => assertInternalBenefitQuote(quote({ tenders: [{ kind: 'wechat', reference: null, amountMinor: 100 }] })))
      .toThrow('PAYMENT_INTERNAL_BENEFIT_ONLY');
    expect(() => assertInternalBenefitQuote(quote({ tenders: [{ kind: 'voucher', reference: 'voucher:one', amountMinor: 100 }] })))
      .toThrow('PAYMENT_INTERNAL_BENEFIT_ONLY');
    expect(() => assertInternalBenefitQuote(quote({ tenders: [{ kind: 'benefit', reference: 'account:one', amountMinor: 99 }] })))
      .toThrow('PAYMENT_TENDER_SUM_MISMATCH');
  });

  it('requires AAL2 before order or capture', () => {
    expect(() => assertPurchaseAssurance(1)).toThrow('MOBILE_ASSURANCE_REQUIRED');
    expect(() => assertPurchaseAssurance(2)).not.toThrow();
  });

  it('allows purchase commands only for a storefront session', () => {
    expect(() => assertPurchaseTarget('storefront')).not.toThrow();
    expect(() => assertPurchaseTarget('console')).toThrow('PURCHASE_AUDIENCE_TARGET_MISMATCH');
    expect(() => assertPurchaseTarget('store')).toThrow('PURCHASE_AUDIENCE_TARGET_MISMATCH');
    expect(() => assertPurchaseTarget('supplier')).toThrow('PURCHASE_AUDIENCE_TARGET_MISMATCH');
  });

  it('rejects missing, external, stale, or mismatched intents before settlement', () => {
    const valid = intent();
    expect(() => assertInternalIntent(valid)).not.toThrow();
    expect(() => assertInternalIntent(undefined)).toThrow('PAYMENT_INTENT_NOT_PAYABLE');
    expect(() => assertInternalIntent({ ...valid, state: 'captured' })).toThrow('PAYMENT_INTENT_NOT_PAYABLE');
    expect(() => assertInternalIntent({ ...valid, unsupported_tenders: 1 })).toThrow('PAYMENT_EXTERNAL_TENDER_FORBIDDEN');
    expect(() => assertInternalIntent({ ...valid, tender_total: 99 })).toThrow('PAYMENT_TENDER_SUM_MISMATCH');
  });
});

function quote(overrides: Partial<CheckoutQuote> = {}): CheckoutQuote {
  return {
    cart: { id: 'cart:one', member: 'member:one', mall: 'mall:one', application: 'application:one', version: 1 },
    selection: { address: null, invoice: null, delivery: {}, vouchers: [], benefits: [{ account: 'account:one', amountMinor: 100 }] },
    lines: [], subtotalMinor: 100, discountMinor: 0, payableMinor: 100, personalMinor: 0, currency: 'CNY',
    tenders: [{ kind: 'benefit', reference: 'account:one', amountMinor: 100 }], evidence: {}, rejections: [],
    ...overrides,
  };
}

function intent() {
  return { intent: 'intent:one', order_id: 'order:one', scope_id: 'mall:one', mall_id: 'mall:one', member_id: 'member:one',
    amount_minor: 100, currency: 'CNY', state: 'created', tender_count: 1, tender_total: 100, unsupported_tenders: 0 };
}
