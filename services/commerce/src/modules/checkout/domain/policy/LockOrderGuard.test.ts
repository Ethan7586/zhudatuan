import { describe, expect, it } from 'vitest';
import { CHECKOUT_LOCK_ORDER, LockOrderGuard } from './LockOrderGuard';

describe('LockOrderGuard', () => {
  it('accepts only the canonical checkout lock sequence', () => {
    const guard = LockOrderGuard.afterIdempotency();
    for (const stage of CHECKOUT_LOCK_ORDER.slice(1)) guard.advance(stage);
    expect(() => guard.complete()).not.toThrow();
  });

  it('rejects lock-order descent or skipped stages', () => {
    const guard = LockOrderGuard.afterIdempotency();
    guard.advance('quote');
    expect(() => guard.advance('inventory')).toThrow('CHECKOUT_LOCK_ORDER_VIOLATION:cart:inventory');
    expect(() => guard.advance('idempotency')).toThrow('CHECKOUT_LOCK_ORDER_VIOLATION:cart:idempotency');
  });
});
