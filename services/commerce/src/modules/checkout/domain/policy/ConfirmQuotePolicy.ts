import { Money } from '@shop/kernel';
import { RUNTIME_LIMITS } from '@shop/config/runtime';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { CheckoutQuote } from '../model/CheckoutQuote';
import { quoteHash } from '../service/QuoteSigner';

const EXACT_EVIDENCE = Object.freeze(['cart', 'profile', 'address', 'invoice', 'experience', 'qualification', 'marketing', 'vouchers', 'benefits', 'shipping', 'tax']);

export class ConfirmQuotePolicy {
  constructor(private readonly maximumPriceDriftMinor: number = RUNTIME_LIMITS.checkout.maximumPriceDriftMinor) {
    if (!Number.isSafeInteger(maximumPriceDriftMinor) || maximumPriceDriftMinor < 0) throw new Error('CHECKOUT_PRICE_DRIFT_INVALID');
  }

  assertCurrent(stored: CheckoutQuote, current: CheckoutQuote, expiresAt: Date | string, now = new Date()): void {
    const expiry = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
    if (Number.isNaN(expiry.getTime()) || expiry.getTime() <= now.getTime()) return quoteExpired();
    if (stored.cart.id !== current.cart.id || stored.cart.version !== current.cart.version || quoteHash(stored.selection) !== quoteHash(current.selection)) return quoteExpired();
    if (stored.lines.length !== current.lines.length || current.rejections.length > 0) return quoteExpired();
    const currentLines = new Map(current.lines.map((line) => [line.listing, line]));
    for (const frozen of stored.lines) {
      const live = currentLines.get(frozen.listing);
      if (!live || !live.accepted || live.sku !== frozen.sku || live.quantity !== frozen.quantity) return quoteExpired();
      const frozenVersions = omitPrice(frozen.versions);
      const liveVersions = omitPrice(live.versions);
      if (quoteHash(frozenVersions) !== quoteHash(liveVersions)) return quoteExpired();
    }
    for (const key of EXACT_EVIDENCE) if (quoteHash(stored.evidence[key]) !== quoteHash(current.evidence[key])) return quoteExpired();
    if (Math.abs(stored.payableMinor - current.payableMinor) > this.maximumPriceDriftMinor) return quoteExpired();
  }
}

function omitPrice(versions: Readonly<Record<string, string | number>>): Readonly<Record<string, string | number>> {
  return Object.freeze(Object.fromEntries(Object.entries(versions).filter(([key]) => key !== 'price')));
}

function quoteExpired(): never {
  throw new DomainError('PRICE_QUOTE_EXPIRED');
}

export function experienceVersion(quote: CheckoutQuote): string | null {
  const value = quote.evidence.experience;
  return value !== null && typeof value === 'object' && !Array.isArray(value) && typeof (value as Record<string, unknown>).version === 'string' ? ((value as Record<string, string>).version ?? null) : null;
}

export function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 255) throw new DomainError('VALIDATION_FAILED', { field });
  return value;
}

export function integer(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new DomainError('VALIDATION_FAILED', { field });
  return value as number;
}

export function object(value: unknown, field: string): Readonly<Record<string, unknown>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new DomainError('VALIDATION_FAILED', { field });
  return value as Readonly<Record<string, unknown>>;
}

export function paymentScene(value: unknown): 'miniapp' | 'jsapi' {
  if (value !== 'miniapp' && value !== 'jsapi') throw new DomainError('VALIDATION_FAILED', { field: 'paymentScene' });
  return value;
}

export function byReference(left: Readonly<{ reference: string | null }>, right: Readonly<{ reference: string | null }>): number {
  return (left.reference ?? '').localeCompare(right.reference ?? '');
}

export function assertTenderTotal(quote: CheckoutQuote, payable: Money): void {
  const total = quote.tenders.reduce((sum, tender) => sum.add(Money.of(tender.amountMinor, quote.currency)), Money.zero(quote.currency));
  if (!total.equals(payable)) throw new Error('CHECKOUT_TENDER_TOTAL_INVALID');
}
