import { describe, expect, it, vi } from 'vitest';
import type { QueryResult } from 'pg';
import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import { withReadTransaction } from '../../../../test/TransactionFixture';
import { PgPaymentRepository } from './PgPaymentRepository';

function result(rows: readonly Record<string, unknown>[]): QueryResult {
  return { rows: [...rows], rowCount: rows.length } as unknown as QueryResult;
}

const order = Object.freeze({ id: 'order:one', number: 'ZD1', scope: 'mall:one', mall: 'mall:one', member: 'member:one', currency: 'CNY', totalMinor: 100, paymentState: 'authorizing', lifecycleState: 'awaitingpayment' });

describe('PaymentReader', () => {
  it('returns only the active controlled action for the owning member', async () => {
    const database = {
      query: vi.fn(async () =>
        result([
          {
            intent_id: 'intent:one',
            order_id: 'order:one',
            intent_state: 'pending',
            expires_at: '2026-08-31T01:30:00.000Z',
            payment_id: null,
            attempt_state: 'pending',
            action: { timeStamp: '1', nonceStr: 'safe' },
          },
        ])
      ),
    };
    const payments = new PgPaymentRepository(new PgTransactionAccess(), { member: vi.fn(async () => 'member:one') }, { payment: vi.fn(async () => order) });
    await expect(withReadTransaction(database.query, (context) => payments.read(context, 'membership:one', 'intent:one'))).resolves.toEqual({
      intentId: 'intent:one',
      orderId: 'order:one',
      paymentId: 'intent:one',
      state: 'pending',
      action: { timeStamp: '1', nonceStr: 'safe' },
      expiresAt: '2026-08-31T01:30:00.000Z',
      retryAfter: 5,
    });
  });

  it('projects an unknown provider outcome as recovery', async () => {
    const database = {
      query: vi.fn(async () => result([{ intent_id: 'intent:one', order_id: 'order:one', intent_state: 'preparing', expires_at: '2026-08-31T01:30:00.000Z', payment_id: null, attempt_state: 'unknown', action: null }])),
    };
    const payments = new PgPaymentRepository(new PgTransactionAccess(), { member: vi.fn(async () => 'member:one') }, { payment: vi.fn(async () => order) });
    await expect(withReadTransaction(database.query, (context) => payments.read(context, 'membership:one', 'intent:one'))).resolves.toMatchObject({ state: 'recovery', retryAfter: 5 });
  });

  it('projects a provider capture even when the local intent had already expired', async () => {
    const database = {
      query: vi.fn(async () => result([{ intent_id: 'intent:one', order_id: 'order:one', intent_state: 'expired', expires_at: '2026-08-31T01:30:00.000Z', payment_id: 'payment:late', attempt_state: 'succeeded', action: null }])),
    };
    const payments = new PgPaymentRepository(new PgTransactionAccess(), { member: vi.fn(async () => 'member:one') }, { payment: vi.fn(async () => order) });
    await expect(withReadTransaction(database.query, (context) => payments.read(context, 'membership:one', 'intent:one'))).resolves.toMatchObject({ paymentId: 'payment:late', state: 'captured', retryAfter: 0 });
  });

  it('hides another member payment as not found', async () => {
    const database = { query: vi.fn(async () => result([])) };
    const payments = new PgPaymentRepository(new PgTransactionAccess(), { member: vi.fn(async () => 'member:one') }, { payment: vi.fn() });
    await expect(withReadTransaction(database.query, (context) => payments.read(context, 'membership:one', 'intent:other'))).rejects.toThrow('RESOURCE_NOT_FOUND');
  });
});
