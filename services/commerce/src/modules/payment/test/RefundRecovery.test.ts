import { describe, expect, it, vi } from 'vitest';
import { PgTransactionAccess } from '../../../adapter/database/PgTransactionAccess';
import { result, withReadTransaction, withWriteTransaction } from '../../../test/TransactionFixture';
import { PgRecoveryRepository } from '../infrastructure/persistence/PgRecoveryRepository';
import { afterSaleRefundRunnable } from '../infrastructure/persistence/PgRefundRecoveryProcess';
import { RefundPlanner } from '../infrastructure/persistence/RefundPlanner';

describe('Payment aftersale refund gate', () => {
  it('starts only after the Order aggregate reaches refunding', () => {
    expect(afterSaleRefundRunnable('refunding')).toBe(true);
    for (const state of ['applied', 'reviewing', 'approved', 'returning', 'received', 'resolved', 'rejected']) {
      expect(afterSaleRefundRunnable(state)).toBe(false);
    }
  });
});

describe('Payment recovery and refund concurrency', () => {
  it('filters recovery cases by the exact order and returns its optimistic version', async () => {
    const query = vi.fn(async (sql: string, values: readonly unknown[] = []) => {
      if (sql.includes('from payment.recoverycase recovery')) {
        expect(values[4]).toBe('order:one');
        expect(sql).toContain('recovery.order_id=$5');
        return result([{ id: 'recovery:one', order_id: 'order:one', resource_type: 'intent', resource_id: 'intent:one', severity: 'critical', state: 'open', error_code: 'PAYMENT_LATE_SUCCESS', evidence: {}, occurrence_count: 2, opened_at: '2026-09-05T00:00:00.000Z', resolved_at: null, resolution_request_id: null, version: 4 }]);
      }
      return result([]);
    });
    const repository = recoveryRepository();
    const page = await withReadTransaction(query, (context) => repository.read(context, { scope: 'enterprise:one', order: 'order:one', page: { sort: null, id: null, fetch: 51, limit: 50 } }));
    expect(page).toMatchObject({ items: [{ id: 'recovery:one', order_number: 'SW-1', version: 4 }], count: 1 });
  });

  it('rejects a stale recovery resolution before writing evidence or scheduling work', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('from payment.recoverycase') && sql.includes('for update')) {
        return result([{ id: 'recovery:one', scope_id: 'enterprise:one', resource_type: 'intent', resource_id: 'intent:one', state: 'open', evidence: {}, version: 5 }]);
      }
      throw new Error(`UNEXPECTED_QUERY:${sql}`);
    });
    await expect(withWriteTransaction(query, (context) => recoveryRepository().resolve(context, {
      case: 'recovery:one', action: 'requery', reason: '重新核对渠道结果', scope: 'enterprise:one', actor: 'actor:one', membership: 'membership:one', trace: 'trace:one', idempotency: 'recovery-key', expectedVersion: 4,
    }))).rejects.toThrow('VERSION_CONFLICT');
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('checks refund versions for a new command but preserves an identical idempotent replay', async () => {
    const payment = { intent_id: 'intent:one', order_id: 'order:one', currency: 'CNY', captured_minor: 10_000, version: 7 };
    const existing = { id: 'refund:existing', payment_id: 'payment:one', provider: 'wechat', provider_reference: 'refund:existing', amount_minor: 1000, currency: 'CNY', state: 'requested', reason: '差额退回', aftersale_id: null };
    const orders = { payment: vi.fn(async () => ({ id: 'order:one', scope: 'enterprise:one' })), recordRefund: vi.fn() };
    const planner = new RefundPlanner(orders as never);
    const staleQuery = vi.fn(async (sql: string) => {
      if (sql.includes('from payment.payment payment')) return result([payment]);
      if (sql.includes('from payment.refund where')) return result([]);
      throw new Error(`UNEXPECTED_QUERY:${sql}`);
    });
    await expect(withWriteTransaction(staleQuery, (context) => planner.create(context, refundRequest('new-key', 6)))).rejects.toThrow('VERSION_CONFLICT');
    const replayQuery = vi.fn(async (sql: string) => {
      if (sql.includes('from payment.payment payment')) return result([payment]);
      if (sql.includes('from payment.refund where')) return result([existing]);
      throw new Error(`UNEXPECTED_QUERY:${sql}`);
    });
    await expect(withWriteTransaction(replayQuery, (context) => planner.create(context, refundRequest('replay-key', 6)))).resolves.toEqual(existing);
    expect(orders.recordRefund).not.toHaveBeenCalled();
  });
});

function recoveryRepository(): PgRecoveryRepository {
  return new PgRecoveryRepository(
    new PgTransactionAccess(),
    { descendants: vi.fn(async () => ['enterprise:one']) },
    { numbers: vi.fn(async () => ({ 'order:one': 'SW-1' })) }
  );
}

function refundRequest(idempotency: string, expectedVersion: number) {
  return { id: 'refund:one', payment: 'payment:one', amountMinor: 1000, idempotency, reason: '差额退回', scope: 'enterprise:one', scopes: ['enterprise:one'], expectedVersion };
}
