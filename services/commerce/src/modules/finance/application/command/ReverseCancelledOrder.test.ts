import { describe, expect, it, vi } from 'vitest';
import { ReverseCancelledOrder } from './ReverseCancelledOrder';

describe('ReverseCancelledOrder', () => {
  it('reverses exactly the posted external-tender accrual for a mixed-tender cancellation', async () => {
    const query = vi.fn(async (sql: string, _values?: readonly unknown[]) => {
      if (sql.includes('from ordering.orderrecord')) {
        return rows([
          {
            scope_id: 'mall:one',
            currency: 'CNY',
            total_minor: '1000',
            lifecycle_state: 'cancelled',
            tenders: [
              { kind: 'wechat', amountMinor: '400' },
              { kind: 'benefit', amountMinor: '300' },
              { kind: 'voucher', amountMinor: '300' },
            ],
          },
        ]);
      }
      if (sql.includes('from finance.journal journal')) {
        return rows([{ id: 'journal:order:one', currency: 'CNY', entry_count: 2, receivable_minor: '400', revenue_minor: '400' }]);
      }
      if (sql.includes('select finance.reverse')) return rows([{ journal: 'journal:reversal:one' }]);
      throw new Error(`UNEXPECTED_QUERY:${sql}`);
    });

    await new ReverseCancelledOrder().execute(database(query), { order: 'order:one', reason: 'paymenttimeout' }, { scope_id: 'mall:one', occurred_at: '2026-08-28T02:00:00.000Z' });

    const reversal = query.mock.calls.find(([sql]) => sql.includes('select finance.reverse'));
    expect(reversal?.[1]).toEqual(['mall:one', 'journal:order:one', 'order.cancelled:order:one', 'Order cancelled: paymenttimeout', 'system:reconciliation', '2026-08-28T02:00:00.000Z']);
  });

  it('records an evidence-backed no-op for an internal-only order', async () => {
    const query = vi.fn(async (sql: string, _values?: readonly unknown[]) => {
      if (sql.includes('from ordering.orderrecord')) {
        return rows([
          {
            scope_id: 'mall:one',
            currency: 'CNY',
            total_minor: '600',
            lifecycle_state: 'cancelled',
            tenders: [
              { kind: 'benefit', amountMinor: '300' },
              { kind: 'voucher', amountMinor: '300' },
            ],
          },
        ]);
      }
      if (sql.includes('from finance.journal journal')) return rows([]);
      throw new Error(`UNEXPECTED_QUERY:${sql}`);
    });

    await new ReverseCancelledOrder().execute(database(query), { order: 'order:internal', reason: 'paymenttimeout' }, { scope_id: 'mall:one', occurred_at: '2026-08-28T02:00:00.000Z' });

    expect(query.mock.calls.some(([sql]) => sql.includes('select finance.reverse'))).toBe(false);
  });

  it('fails closed when an external tender should have an accrual but the journal is missing', async () => {
    const query = vi.fn(async (sql: string, _values?: readonly unknown[]) => {
      if (sql.includes('from ordering.orderrecord')) {
        return rows([
          {
            scope_id: 'mall:one',
            currency: 'CNY',
            total_minor: '400',
            lifecycle_state: 'cancelled',
            tenders: [{ kind: 'wechat', amountMinor: '400' }],
          },
        ]);
      }
      if (sql.includes('from finance.journal journal')) return rows([]);
      throw new Error(`UNEXPECTED_QUERY:${sql}`);
    });

    await expect(new ReverseCancelledOrder().execute(database(query), { order: 'order:missing', reason: 'paymenttimeout' }, { scope_id: 'mall:one', occurred_at: '2026-08-28T02:00:00.000Z' })).rejects.toThrow(
      'FINANCE_ORDER_ACCRUAL_MISSING_OR_INVALID'
    );
  });
});

function rows(values: readonly Record<string, unknown>[]) {
  return Promise.resolve({ rows: values });
}

function database(query: unknown): Parameters<ReverseCancelledOrder['execute']>[0] {
  return { query } as unknown as Parameters<ReverseCancelledOrder['execute']>[0];
}
