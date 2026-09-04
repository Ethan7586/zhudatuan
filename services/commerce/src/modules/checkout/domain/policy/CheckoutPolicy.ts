import { Money } from '@shop/kernel';
import { RUNTIME_LIMITS } from '@shop/config/runtime';
import type { CheckoutSelection } from '../model/CheckoutSelection';
import type { ShippingSnapshot, TaxSnapshot } from '../model/CheckoutQuote';

export class CheckoutPolicy {
  constructor(private readonly quoteTtlSeconds: number = RUNTIME_LIMITS.checkout.quoteTtlSeconds) {
    if (!Number.isSafeInteger(quoteTtlSeconds) || quoteTtlSeconds < 60) throw new Error('CHECKOUT_QUOTE_TTL_INVALID');
  }

  expiresAt(now: Date): string {
    return new Date(now.getTime() + this.quoteTtlSeconds * 1000).toISOString();
  }

  shipping(selection: CheckoutSelection, physical: boolean): ShippingSnapshot {
    const method = physical ? selection.delivery.method : 'digital';
    return Object.freeze({ method, amountMinor: 0, version: `shipping:${method}:1` });
  }

  tax(): TaxSnapshot {
    return Object.freeze({ mode: 'included', amountMinor: 0, version: 'tax:included:1' });
  }

  payable(subtotal: Money, discount: Money, shipping: Money, tax: Money): Money {
    if (discount.minor > subtotal.minor) throw new Error('CHECKOUT_DISCOUNT_INVALID');
    return subtotal.subtract(discount).add(shipping).add(tax);
  }

  assertVersions(expected: Readonly<Record<string, number>>, actual: Readonly<Record<string, number>>): void {
    for (const [key, version] of Object.entries(expected)) if (actual[key] !== version) throw new Error(`CHECKOUT_VERSION_CONFLICT:${key}`);
  }

  allocateTenders(total: Money, vouchers: readonly ValueChoice[], benefits: readonly ValueChoice[]): Readonly<{ tenders: readonly TenderAllocation[]; personal: Money }> {
    let remaining = total;
    const tenders: TenderAllocation[] = [];
    for (const value of [...vouchers].sort(byId)) {
      const amount = Money.of(Math.min(remaining.minor, value.amount.minor), total.currency.code);
      if (amount.minor > 0) tenders.push({ kind: 'voucher', reference: value.id, amount });
      remaining = remaining.subtract(amount);
    }
    for (const value of [...benefits].sort(byId)) {
      const amount = Money.of(Math.min(remaining.minor, value.amount.minor), total.currency.code);
      if (amount.minor > 0) tenders.push({ kind: 'benefit', reference: value.id, amount });
      remaining = remaining.subtract(amount);
    }
    if (remaining.minor > 0) tenders.push({ kind: 'wechat', reference: null, amount: remaining });
    return Object.freeze({ tenders: Object.freeze(tenders), personal: remaining });
  }
}
export interface ValueChoice {
  readonly id: string;
  readonly amount: Money;
}
export interface TenderAllocation {
  readonly kind: 'voucher' | 'benefit' | 'wechat';
  readonly reference: string | null;
  readonly amount: Money;
}

function byId(left: ValueChoice, right: ValueChoice): number {
  return left.id.localeCompare(right.id);
}
