import type { CheckoutDraft } from '../model/CheckoutDraft';
import type { Quote } from '../model/Quote';

export const checkoutQuery = (scope: string) => Object.freeze(['storefront', scope, 'checkout', 'current'] as const);
export const checkoutOptionsQuery = (scope: string) => Object.freeze(['storefront', scope, 'checkout', 'options'] as const);

export type CheckoutPhase = 'loading' | 'editing' | 'quoting' | 'stale' | 'rejected' | 'expired' | 'recovered' | 'quoted' | 'committing' | 'failed';

export interface CheckoutState {
  readonly phase: CheckoutPhase;
  readonly quote: Quote | null;
  readonly canQuote: boolean;
  readonly canCommit: boolean;
}

export function checkoutState(input: Readonly<{
  draft: CheckoutDraft;
  quote: Quote | null;
  loading: boolean;
  failed: boolean;
  quoting: boolean;
  committing: boolean;
  now: number;
}>): CheckoutState {
  const selected = input.draft.lines.length > 0;
  if (input.committing) return state('committing', input.quote, false, false);
  if (input.quoting) return state('quoting', input.quote, false, false);
  if (input.loading) return state('loading', null, false, false);
  if (input.failed) return state('failed', null, false, false);
  if (!input.quote) return state('editing', null, selected, false);
  if (!sameSelection(input.quote.selection, input.draft)) return state('stale', null, selected, false);
  if (input.quote.rejections.length > 0 || input.quote.lines.some(({ accepted }) => !accepted)) return state('rejected', input.quote, selected, false);
  if (Date.parse(input.quote.expiresAt) <= input.now) return state('expired', input.quote, selected, false);
  if (!input.quote.confirmationToken) return state('recovered', input.quote, selected, false);
  return state('quoted', input.quote, false, true);
}

function state(phase: CheckoutPhase, quote: Quote | null, canQuote: boolean, canCommit: boolean): CheckoutState {
  return Object.freeze({ phase, quote, canQuote, canCommit });
}

function sameSelection(left: Quote['selection'], right: CheckoutDraft): boolean {
  return left.cartVersion === right.cartVersion
    && left.addressId === right.addressId
    && left.invoiceId === right.invoiceId
    && left.paymentScene === right.paymentScene
    && left.delivery.method === right.delivery.method
    && left.delivery.note === right.delivery.note
    && left.delivery.scheduledAt === right.delivery.scheduledAt
    && sameList(left.lines, right.lines, (item) => `${item.listingId}\u0000${item.quantity}\u0000${item.lineVersion}`)
    && sameList(left.voucherIds, right.voucherIds, String)
    && sameList(left.benefits, right.benefits, (item) => `${item.accountId}\u0000${item.amountMinor}`);
}

function sameList<T>(left: readonly T[], right: readonly T[], identity: (value: T) => string): boolean {
  if (left.length !== right.length) return false;
  const expected = [...left].map(identity).sort();
  return [...right].map(identity).sort().every((value, index) => value === expected[index]);
}
