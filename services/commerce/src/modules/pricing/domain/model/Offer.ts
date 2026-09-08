import { Money, type CurrencyCode } from '@shop/kernel';
import { DomainError } from '../../../../platform/error/DomainError';

export interface OfferSnapshot {
  readonly id: string;
  readonly book: string;
  readonly sku: string;
  readonly amount: Money;
  readonly compare: Money | null;
  readonly effectiveAt: string;
  readonly expiresAt: string | null;
  readonly version: number;
  readonly updatedAt: string;
}

export class Offer {
  private constructor(private readonly value: OfferSnapshot) {
    validate(value);
    Object.freeze(this);
  }

  static create(
    input: Readonly<{ id: string; book: string; sku: string; amountMinor: number; compareMinor: number | null; currency: CurrencyCode; effectiveAt: string; expiresAt: string | null; version?: number; updatedAt?: string }>
  ): Offer {
    const amount = Money.of(input.amountMinor, input.currency);
    const compare = input.compareMinor === null ? null : Money.of(input.compareMinor, input.currency);
    return new Offer(
      Object.freeze({
        id: input.id,
        book: input.book,
        sku: input.sku,
        amount,
        compare,
        effectiveAt: iso(input.effectiveAt),
        expiresAt: input.expiresAt === null ? null : iso(input.expiresAt),
        version: input.version ?? 1,
        updatedAt: iso(input.updatedAt ?? input.effectiveAt),
      })
    );
  }

  static restore(value: OfferSnapshot): Offer {
    return new Offer(Object.freeze({ ...value }));
  }

  effective(at: Date): OfferSnapshot {
    const time = at.getTime();
    if (time < Date.parse(this.value.effectiveAt) || (this.value.expiresAt !== null && time >= Date.parse(this.value.expiresAt))) {
      throw new DomainError('VALIDATION_FAILED', { field: 'offer', reason: 'OFFER_NOT_EFFECTIVE' });
    }
    return this.value;
  }

  snapshot(): OfferSnapshot {
    return this.value;
  }
}

function validate(value: OfferSnapshot): void {
  if (!/^price:[A-Za-z0-9][A-Za-z0-9.:/-]*$/.test(value.id) || !/^pricebook:/.test(value.book) || !stableReference(value.sku)) invalid('offer');
  if (value.amount.minor < 0 || (value.compare !== null && (value.compare.minor < value.amount.minor || !value.compare.currency.equals(value.amount.currency)))) invalid('amount');
  if (value.expiresAt !== null && Date.parse(value.expiresAt) <= Date.parse(value.effectiveAt)) invalid('period');
  if (!Number.isSafeInteger(value.version) || value.version < 1) invalid('version');
}

function stableReference(value: string): boolean {
  return value.length > 0 && value.length <= 512 && value === value.trim() && !/\s/.test(value);
}

function iso(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) invalid('time');
  return date.toISOString();
}

function invalid(field: string): never {
  throw new DomainError('VALIDATION_FAILED', { field });
}
