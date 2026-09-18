import { afterEach, describe, expect, it } from 'vitest';
import {
  beginPaymentRecovery,
  clearPaymentRecovery,
  finishPaymentSubmission,
  isPaymentRecoveryPending,
  loadPaymentRecovery,
  paymentCartFingerprint,
  paymentRetryIdempotencyKey,
  tryBeginPaymentSubmission,
  updatePaymentRecovery,
} from './paymentRecovery';

class MemoryStorage {
  value: string | null = null;
  getItem() { return this.value; }
  setItem(_key: string, value: string) { this.value = value; }
  removeItem() { this.value = null; }
}

const scope = 'member:one:mall:one';
const now = () => new Date('2026-09-09T05:00:00.000Z');

afterEach(() => clearPaymentRecovery(scope, null));

describe('payment recovery record', () => {
  it('reuses one stable idempotency key while a payment remains unfinished', () => {
    const storage = new MemoryStorage();
    const first = beginPaymentRecovery(input(), { storage, now, createId: () => 'stable-one' });
    const second = beginPaymentRecovery(input(), { storage, now, createId: () => 'must-not-be-used' });
    expect(second).toEqual(first);
    expect(second.idempotencyKey).toBe('checkout-stable-one');
  });

  it('persists only the recovery fields and restores the same order after reload', () => {
    const storage = new MemoryStorage();
    const started = beginPaymentRecovery(input(), { storage, now, createId: () => 'one' });
    const prepared = updatePaymentRecovery(started, {
      stage: 'opening-wechat', orderId: 'order:one', paymentId: 'payment:one', amountMinor: 100,
    }, { storage, now });
    expect(loadPaymentRecovery(scope, storage)).toEqual(prepared);
    expect(storage.value).not.toContain('paySign');
    expect(storage.value).not.toContain('prepay_id');
    expect(storage.value).not.toContain('openid');
  });

  it('uses a deterministic fingerprint independent of item order', () => {
    const left = paymentCartFingerprint('address:one', [
      { cartItemId: 'cart:b', listingId: 'listing:b', quantity: 2 },
      { cartItemId: 'cart:a', listingId: 'listing:a', quantity: 1 },
    ]);
    const right = paymentCartFingerprint('address:one', [
      { cartItemId: 'cart:a', listingId: 'listing:a', quantity: 1 },
      { cartItemId: 'cart:b', listingId: 'listing:b', quantity: 2 },
    ]);
    expect(left).toBe(right);
  });

  it('clears a captured record so a later checkout can receive a new key', () => {
    const storage = new MemoryStorage();
    const first = beginPaymentRecovery(input(), { storage, now, createId: () => 'one' });
    updatePaymentRecovery(first, { stage: 'captured' }, { storage, now });
    const second = beginPaymentRecovery(input(), { storage, now, createId: () => 'two' });
    expect(second.idempotencyKey).toBe('checkout-two');
  });

  it('allows only one checkout submission until the active attempt finishes', () => {
    const lock = { current: false };
    expect(tryBeginPaymentSubmission(lock)).toBe(true);
    expect(tryBeginPaymentSubmission(lock)).toBe(false);
    finishPaymentSubmission(lock);
    expect(tryBeginPaymentSubmission(lock)).toBe(true);
  });

  it('reuses the same retry key after a lost response and changes it only for a new payment intent', () => {
    const record = beginPaymentRecovery(input(), { storage: new MemoryStorage(), now, createId: () => 'one' });
    const repeated = { ...record, paymentId: 'intent:old', retryCount: 9 };
    expect(paymentRetryIdempotencyKey({ ...record, paymentId: 'intent:old' })).toBe('checkout-one:retry-after:intent:old');
    expect(paymentRetryIdempotencyKey(repeated)).toBe('checkout-one:retry-after:intent:old');
    expect(paymentRetryIdempotencyKey({ ...record, paymentId: 'intent:new' })).toBe('checkout-one:retry-after:intent:new');
  });

  it('does not restore a terminal failure when no order was created', () => {
    const started = beginPaymentRecovery(input(), { storage: new MemoryStorage(), now, createId: () => 'one' });
    expect(isPaymentRecoveryPending(updatePaymentRecovery(started, { stage: 'failed' }, { storage: null, now }))).toBe(false);
    expect(isPaymentRecoveryPending(updatePaymentRecovery(started, { stage: 'failed', orderId: 'order:one' }, { storage: null, now }))).toBe(true);
  });
});

function input() {
  return {
    scope,
    amountMinor: 100,
    currency: 'CNY',
    mallName: '福福网',
    cartFingerprint: 'cart-one',
    cartItemIds: ['cart:one'],
  };
}
