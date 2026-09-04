import { Currency, type CurrencyCode } from './Currency';

export class Money {
  private constructor(readonly minor: number, readonly currency: Currency) {
    Object.freeze(this);
  }

  static of(minor: number, currency: CurrencyCode = 'CNY'): Money {
    if (!Number.isSafeInteger(minor)) throw new Error('MONEY_MINOR_INVALID');
    return new Money(minor, Currency.of(currency));
  }

  static zero(currency: CurrencyCode = 'CNY'): Money {
    return Money.of(0, currency);
  }

  add(other: Money): Money {
    this.assertCurrency(other);
    return Money.of(safeAdd(this.minor, other.minor), this.currency.code);
  }

  subtract(other: Money): Money {
    this.assertCurrency(other);
    return Money.of(safeAdd(this.minor, -other.minor), this.currency.code);
  }

  multiply(factor: number): Money {
    if (!Number.isSafeInteger(factor)) throw new Error('MONEY_FACTOR_INVALID');
    const value = this.minor * factor;
    if (!Number.isSafeInteger(value)) throw new Error('MONEY_OVERFLOW');
    return Money.of(value, this.currency.code);
  }

  equals(other: Money): boolean {
    return this.minor === other.minor && this.currency.equals(other.currency);
  }

  private assertCurrency(other: Money): void {
    if (!this.currency.equals(other.currency)) throw new Error('MONEY_CURRENCY_MISMATCH');
  }
}

function safeAdd(left: number, right: number): number {
  const value = left + right;
  if (!Number.isSafeInteger(value)) throw new Error('MONEY_OVERFLOW');
  return value;
}
