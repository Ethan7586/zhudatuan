import type { OrganizationScopeSnapshot } from '../../../organization/public';
import type { CheckoutQuote } from '../../domain/model/CheckoutQuote';
import type { CheckoutPort } from './CheckoutPort';

export function orderSnapshots(quote: CheckoutQuote): Readonly<{ address: unknown; invoice: unknown }> {
  return Object.freeze({ address: quote.address?.value ?? null, invoice: quote.invoice?.value ?? null });
}

export function paymentSnapshot(checkout: Pick<CheckoutPort, 'digest'>, quote: CheckoutQuote, scope: OrganizationScopeSnapshot, order: string, number: string) {
  return Object.freeze({
    order,
    number,
    member: quote.cart.member,
    mall: quote.cart.mall,
    application: quote.cart.application,
    scopes: Object.freeze([scope.id, ...scope.ancestors]),
    timezone: scope.timezone,
    totalMinor: quote.payableMinor,
    currency: quote.currency,
    evidenceHash: checkout.digest(quote.evidence),
    tenders: quote.tenders,
    lines: quote.lines.map(({ listing, sku, product, category, provider, partner, totalMinor, discountMinor, payableMinor }) => ({ line: listing, sku, product, category, provider, partner, totalMinor, discountMinor, payableMinor })),
  });
}
