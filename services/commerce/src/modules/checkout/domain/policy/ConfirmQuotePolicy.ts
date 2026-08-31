import { Money } from '@shop/kernel';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { CheckoutQuote } from '../model/CheckoutQuote';

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
