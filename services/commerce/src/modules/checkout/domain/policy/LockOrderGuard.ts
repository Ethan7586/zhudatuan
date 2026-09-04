export const CHECKOUT_LOCK_ORDER = Object.freeze(['idempotency', 'quote', 'cart', 'inventory', 'voucher', 'marketing', 'benefit', 'order', 'payment', 'finance', 'audit', 'outbox'] as const);

export type CheckoutLock = (typeof CHECKOUT_LOCK_ORDER)[number];

export class LockOrderGuard {
  private index: number;

  private constructor(current: CheckoutLock) {
    this.index = CHECKOUT_LOCK_ORDER.indexOf(current);
  }

  static afterIdempotency(): LockOrderGuard {
    return new LockOrderGuard('idempotency');
  }

  advance(next: CheckoutLock): void {
    const expected = CHECKOUT_LOCK_ORDER[this.index + 1];
    if (next !== expected) throw new Error(`CHECKOUT_LOCK_ORDER_VIOLATION:${expected ?? 'complete'}:${next}`);
    this.index += 1;
  }

  complete(): void {
    if (this.index !== CHECKOUT_LOCK_ORDER.length - 1) {
      throw new Error(`CHECKOUT_LOCK_ORDER_INCOMPLETE:${CHECKOUT_LOCK_ORDER[this.index + 1]}`);
    }
  }
}
