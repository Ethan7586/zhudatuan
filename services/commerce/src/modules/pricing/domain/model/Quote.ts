import { Money, type CurrencyCode } from '@shop/kernel';
import { DomainError } from '../../../../platform/error/DomainError';

export interface QuoteSnapshot {
  readonly id: string;
  readonly member: string;
  readonly mall: string;
  readonly currency: CurrencyCode;
  readonly subtotal: Money;
  readonly discount: Money;
  readonly payable: Money;
  readonly lines: readonly unknown[];
  readonly evidenceHash: string;
  readonly dependencies: Readonly<Record<string, unknown>>;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly signature: string;
  readonly version: number;
  readonly expiresAt: string;
  readonly createdAt: string;
}

export class Quote {
  private constructor(private readonly value: QuoteSnapshot) {
    validate(value);
    Object.freeze(this);
  }

  static create(
    input: Readonly<{
      id: string;
      member: string;
      mall: string;
      currency: CurrencyCode;
      subtotalMinor: number;
      discountMinor: number;
      payableMinor: number;
      lines: readonly unknown[];
      evidenceHash: string;
      dependencies: Readonly<Record<string, unknown>>;
      payload: Readonly<Record<string, unknown>>;
      signature: string;
      expiresAt: string;
      createdAt: string;
    }>
  ): Quote {
    return new Quote(
      freeze({
        ...input,
        subtotal: Money.of(input.subtotalMinor, input.currency),
        discount: Money.of(input.discountMinor, input.currency),
        payable: Money.of(input.payableMinor, input.currency),
        version: 1,
        expiresAt: iso(input.expiresAt),
        createdAt: iso(input.createdAt),
      })
    );
  }

  static restore(value: QuoteSnapshot): Quote {
    return new Quote(freeze(value));
  }

  use(member: string, mall: string, at: Date): QuoteSnapshot {
    if (member !== this.value.member || mall !== this.value.mall) throw new DomainError('PRICE_QUOTE_EXPIRED');
    if (at.getTime() >= Date.parse(this.value.expiresAt)) throw new DomainError('PRICE_QUOTE_EXPIRED');
    return this.value;
  }

  snapshot(): QuoteSnapshot {
    return this.value;
  }
}

function validate(value: QuoteSnapshot): void {
  if (!/^quote:[A-Za-z0-9][A-Za-z0-9.:/-]*$/.test(value.id) || !value.member || !value.mall) invalid('quote');
  if (value.subtotal.minor < 0 || value.discount.minor < 0 || value.payable.minor < 0 || value.subtotal.subtract(value.discount).minor !== value.payable.minor) invalid('amount');
  if (!/^[0-9a-f]{64}$/.test(value.evidenceHash) || !/^[0-9a-f]{64}$/.test(value.signature)) invalid('hash');
  if (Date.parse(value.expiresAt) <= Date.parse(value.createdAt)) invalid('period');
  if (!Number.isSafeInteger(value.version) || value.version < 1) invalid('version');
}

function freeze(value: QuoteSnapshot): QuoteSnapshot {
  return Object.freeze({ ...value, lines: Object.freeze([...value.lines]), dependencies: Object.freeze({ ...value.dependencies }), payload: Object.freeze({ ...value.payload }) });
}
function iso(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) invalid('time');
  return date.toISOString();
}
function invalid(field: string): never {
  throw new DomainError('VALIDATION_FAILED', { field });
}
