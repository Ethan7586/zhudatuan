import { describe, expect, it, vi } from 'vitest';
import type { DatabasePool } from '../../../../foundation/persistence/Pool';
import {
  ReadPaymentIntent,
  type PaymentIntentReader,
  type PaymentIntentSnapshot,
} from '../../03_application_yingyong/queries_duqu/ReadPaymentIntent';
import { PgPaymentIntentReader } from '../../04_adapters_shixian/persistence_cunchu/PgPaymentIntentReader';

const base: PaymentIntentSnapshot = Object.freeze({
  intentId: 'intent:one',
  orderId: 'order:one',
  intentState: 'authorizing',
  expiresAt: '2026-09-05T12:00:00.000Z',
  amountMinor: 8800,
  currency: 'CNY',
  paymentId: null,
  paymentState: null,
  attemptState: 'pending',
  action: { timeStamp: '1', nonceStr: 'safe' },
});

function usecase(snapshot: PaymentIntentSnapshot | undefined) {
  const reader: PaymentIntentReader = { read: vi.fn(async () => snapshot) };
  return new ReadPaymentIntent(reader, () => new Date('2026-09-05T11:00:00.000Z'));
}

describe('ReadPaymentIntent', () => {
  it('returns the active provider action while payment is pending', async () => {
    await expect(usecase(base).execute({ payment: 'intent:one', membership: 'membership:one', mall: 'mall:one' })).resolves.toEqual({
      intentId: 'intent:one', orderId: 'order:one', paymentId: 'intent:one', state: 'pending', paymentState: null,
      amountMinor: 8800, currency: 'CNY', action: { timeStamp: '1', nonceStr: 'safe' },
      expiresAt: '2026-09-05T12:00:00.000Z', retryAfter: 5,
    });
  });

  it('treats the final payment record as authoritative over stale intent data', async () => {
    const result = await usecase({ ...base, paymentId: 'payment:one', paymentState: 'partially_refunded' })
      .execute({ payment: 'payment:one', membership: 'membership:one', mall: 'mall:one' });
    expect(result).toMatchObject({ paymentId: 'payment:one', state: 'captured', action: null, retryAfter: 0 });
  });

  it('never guesses failure while the provider outcome is unknown', async () => {
    const result = await usecase({ ...base, intentState: 'expired', attemptState: 'unknown' })
      .execute({ payment: 'intent:one', membership: 'membership:one', mall: 'mall:one' });
    expect(result).toMatchObject({ state: 'recovery', action: null, retryAfter: 5 });
  });

  it('reports expiry from the authoritative expiry time', async () => {
    const result = await usecase({ ...base, expiresAt: '2026-09-05T10:00:00.000Z', attemptState: null })
      .execute({ payment: 'intent:one', membership: 'membership:one', mall: 'mall:one' });
    expect(result).toMatchObject({ state: 'expired', retryAfter: 0 });
  });

  it('hides absent or non-owned payment intents as not found', async () => {
    await expect(usecase(undefined).execute({ payment: 'intent:other', membership: 'membership:one', mall: 'mall:one' }))
      .rejects.toThrow('PAYMENT_INTENT_NOT_FOUND');
  });
});

describe('PgPaymentIntentReader', () => {
  it('scopes a payment or intent lookup to the authenticated membership and mall', async () => {
    const query = vi.fn(async () => ({ rows: [{
      intent_id: 'intent:one', order_id: 'order:one', intent_state: 'captured', expires_at: '2026-09-05T12:00:00.000Z',
      amount_minor: 8800, currency: 'CNY', payment_id: 'payment:one', payment_state: 'captured', attempt_state: 'succeeded', action: null,
    }], rowCount: 1 }));
    const reader = new PgPaymentIntentReader({ query } as unknown as DatabasePool);
    await expect(reader.read({ payment: 'payment:one', membership: 'membership:one', mall: 'mall:one' }))
      .resolves.toMatchObject({ intentId: 'intent:one', paymentId: 'payment:one' });
    expect(query).toHaveBeenCalledWith(expect.stringContaining('membership.id=$2'), ['payment:one', 'membership:one', 'mall:one']);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('intent.mall_id=$3'), ['payment:one', 'membership:one', 'mall:one']);
  });
});
