export const CURRENCIES = ['CNY'] as const;
export type CurrencyCode = (typeof CURRENCIES)[number];

export class Currency {
  private constructor(readonly code: CurrencyCode) {}

  static of(code: string): Currency {
    if (!CURRENCIES.includes(code as CurrencyCode)) throw new Error('CURRENCY_UNSUPPORTED');
    return new Currency(code as CurrencyCode);
  }

  equals(other: Currency): boolean {
    return this.code === other.code;
  }
}
