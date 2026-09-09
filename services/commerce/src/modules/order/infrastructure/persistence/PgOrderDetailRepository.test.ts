import type { QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { withReadTransaction } from '../../../../test/TransactionFixture';
import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import { PgOrderDetailRepository } from './PgOrderDetailRepository';

describe('PgOrderDetailRepository finance projection', () => {
  it('reads only order-owned financial projections and exposes a bounded reconciliation summary', async () => {
    const query = vi.fn(async (sql: string, _values?: readonly unknown[]) =>
      result(
        sql.includes('"grossMinor"')
          ? [
              {
                grossMinor: 12_800,
                capturedMinor: 12_800,
                refundedMinor: 1_000,
                netMinor: 11_800,
                outstandingMinor: 0,
                currency: 'CNY',
                state: 'partialrefund',
                verificationState: 'verified',
                watermark: new Date('2026-09-05T02:00:00.000Z'),
              },
            ]
          : []
      )
    );
    const repository = new PgOrderDetailRepository(new PgTransactionAccess(), {} as never, orderMedia());
    const value = await withReadTransaction(query, (context) => repository.finance(context, 'order:one'));

    expect(value).toMatchObject({ grossMinor: 12_800, netMinor: 11_800, state: 'partialrefund' });
    const read = query.mock.calls.find(([sql]) => sql.includes('"grossMinor"'));
    expect(read?.[0]).toContain('from ordering.orderrecord');
    expect(read?.[0]).not.toContain(' finance.');
    expect(read?.[1]).toEqual(['order:one']);
  });

  it('fails the local section instead of manufacturing a zero financial state', async () => {
    const repository = new PgOrderDetailRepository(new PgTransactionAccess(), {} as never, orderMedia());
    await expect(
      withReadTransaction(
        async () => result([]),
        (context) => repository.finance(context, 'order:missing')
      )
    ).rejects.toThrow('ORDER_FINANCE_PROJECTION_MISSING');
  });
});

describe('PgOrderDetailRepository contract timestamps', () => {
  it('canonicalizes payment, fulfillment milestone and refund timestamps returned by PostgreSQL', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('from ordering.paymentread payment')) {
        return result([{ paymentId: 'payment:one', updatedAt: '2026-09-05T08:00:00+08:00', tenders: [] }]);
      }
      if (sql.includes('from ordering.fulfillmentread value')) {
        return result([{ id: 'fulfillment:one', createdAt: '2026-09-05T08:01:00+08:00', updatedAt: '2026-09-05T08:02:00+08:00', milestones: [{ occurredAt: '2026-09-05T08:03:00+08:00' }] }]);
      }
      if (sql.includes('aftersale_state state')) return result([{ state: 'reviewing' }]);
      if (sql.includes('from ordering.refundread refund')) return result([{ id: 'refund:one', createdAt: '2026-09-05T08:04:00+08:00', updatedAt: '2026-09-05T08:05:00+08:00', tenders: [] }]);
      return result([]);
    });
    const repository = new PgOrderDetailRepository(new PgTransactionAccess(), {} as never, orderMedia());

    const [payment, fulfillment, aftersale] = await Promise.all([
      withReadTransaction(query, (context) => repository.payment(context, 'order:one')),
      withReadTransaction(query, (context) => repository.fulfillment(context, 'order:one', null)),
      withReadTransaction(query, (context) => repository.aftersale(context, 'order:one')),
    ]);

    expect(payment).toMatchObject({ updatedAt: '2026-09-05T00:00:00.000Z' });
    expect(fulfillment).toEqual([expect.objectContaining({ createdAt: '2026-09-05T00:01:00.000Z', updatedAt: '2026-09-05T00:02:00.000Z', milestones: [{ occurredAt: '2026-09-05T00:03:00.000Z' }] })]);
    expect(aftersale).toMatchObject({ refunds: [{ createdAt: '2026-09-05T00:04:00.000Z', updatedAt: '2026-09-05T00:05:00.000Z' }] });
  });
});

function result(rows: readonly unknown[]): QueryResult<any> {
  return { rows: [...rows], rowCount: rows.length, command: '', oid: 0, fields: [] } as QueryResult<any>;
}

function orderMedia() {
  return { lines: vi.fn(async (rows: readonly Readonly<Record<string, unknown>>[]) => Object.freeze(rows)) };
}
