import { Currency, type CurrencyCode } from '@shop/kernel';
import { DomainError } from '../../../../foundation/domain/DomainError';

export type PriceBookState = 'draft' | 'active' | 'retired';

export interface PriceBookSnapshot {
  readonly id: string;
  readonly scope: string;
  readonly currency: CurrencyCode;
  readonly name: string;
  readonly state: PriceBookState;
  readonly version: number;
}

export class PriceBook {
  private constructor(private readonly value: PriceBookSnapshot) {
    validate(value);
    Object.freeze(this);
  }

  static create(input: Omit<PriceBookSnapshot, 'state' | 'version'>): PriceBook {
    return new PriceBook(Object.freeze({ ...input, name: input.name.trim(), state: 'active', version: 1 }));
  }

  static restore(value: PriceBookSnapshot): PriceBook {
    return new PriceBook(Object.freeze({ ...value }));
  }

  activate(expectedVersion: number): PriceBook {
    this.expect(expectedVersion);
    if (this.value.state === 'retired') throw new DomainError('VALIDATION_FAILED', { field: 'priceBook', reason: 'PRICE_BOOK_RETIRED' });
    return new PriceBook(Object.freeze({ ...this.value, state: 'active', version: this.value.version + 1 }));
  }

  snapshot(): PriceBookSnapshot {
    return this.value;
  }

  private expect(expectedVersion: number): void {
    if (expectedVersion !== this.value.version) throw new DomainError('VERSION_CONFLICT');
  }
}

function validate(value: PriceBookSnapshot): void {
  if (!/^pricebook:[A-Za-z0-9][A-Za-z0-9.:/-]*$/.test(value.id) || !value.scope) invalid('priceBook');
  Currency.of(value.currency);
  if (value.name.length < 1 || value.name.length > 255) invalid('name');
  if (!['draft', 'active', 'retired'].includes(value.state)) invalid('state');
  if (!Number.isSafeInteger(value.version) || value.version < 1) invalid('version');
}

function invalid(field: string): never {
  throw new DomainError('VALIDATION_FAILED', { field });
}
