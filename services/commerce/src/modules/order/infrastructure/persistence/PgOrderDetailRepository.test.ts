import type { QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { withReadTransaction } from '../../../../test/TransactionFixture';
import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import { PgOrderDetailRepository } from './PgOrderDetailRepository';

describe('PgOrderDetailRepository finance projection', () => {
  it('reads only order-owned financial projections and exposes a bounded reconciliation summary', async () => {
    const query = vi.fn(async (sql: string, _values?: readonly unknown[]) => result(sql.includes('"grossMinor"') ? [{ grossMinor: 12_800, capturedMinor: 12_800, refundedMinor: 1_000, netMinor: 11_800, outstandingMinor: 0, currency: 'CNY', state: 'partialrefund', verificationState: 'verified', watermark: new Date('2026-09-05T02:00:00.000Z') }] : []));
    const repository = new PgOrderDetailRepository(new PgTransactionAccess(), {} as never);
    const value = await withReadTransaction(query, (context) => repository.finance(context, 'order:one'));

    expect(value).toMatchObject({ grossMinor: 12_800, netMinor: 11_800, state: 'partialrefund' });
    const read = query.mock.calls.find(([sql]) => sql.includes('"grossMinor"'));
    expect(read?.[0]).toContain('from ordering.orderrecord');
    expect(read?.[0]).not.toContain(' finance.');
    expect(read?.[1]).toEqual(['order:one']);
  });

  it('fails the local section instead of manufacturing a zero financial state', async () => {
    const repository = new PgOrderDetailRepository(new PgTransactionAccess(), {} as never);
    await expect(withReadTransaction(async () => result([]), (context) => repository.finance(context, 'order:missing'))).rejects.toThrow('ORDER_FINANCE_PROJECTION_MISSING');
  });
});

function result(rows: readonly unknown[]): QueryResult<any> {
  return { rows: [...rows], rowCount: rows.length, command: '', oid: 0, fields: [] } as QueryResult<any>;
}
