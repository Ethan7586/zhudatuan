import type { QuoteSelection } from './Quote';

export type CheckoutDraft = QuoteSelection;

export function checkoutDraft(input: Readonly<{
  cartVersion: number;
  lines: QuoteSelection['lines'];
  addressId: string | null;
  voucherIds: readonly string[];
  benefits: QuoteSelection['benefits'];
}>): CheckoutDraft {
  return Object.freeze({
    cartVersion: input.cartVersion,
    lines: Object.freeze([...input.lines].sort((left, right) => left.listingId.localeCompare(right.listingId))),
    addressId: input.addressId,
    invoiceId: null,
    delivery: Object.freeze({ method: 'standard' as const, note: null, scheduledAt: null }),
    voucherIds: Object.freeze([...input.voucherIds].sort()),
    benefits: Object.freeze([...input.benefits].sort((left, right) => left.accountId.localeCompare(right.accountId))),
    paymentScene: 'jsapi',
  });
}
