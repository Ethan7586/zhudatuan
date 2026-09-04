import { describe, expect, it, vi } from 'vitest';
import type { PoolClient } from 'pg';
import { pgTransactionState } from '../../../../adapter/database/PgTransactionState';
import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import { ListingWithdrawal } from './ListingWithdrawal';

describe('listing withdrawal qualification reaction', () => {
  it('unpublishes every affected listing and appends all outbox events in the same transaction with two set-based statements', async () => {
    const query = vi.fn(async (sql: string, _values?: readonly unknown[]) => ({
      rows: sql.startsWith('update catalog.listing')
        ? [{ id: 'listing:one', version: 2 }, { id: 'listing:two', version: 3 }, { id: 'listing:three', version: 4 }]
        : [],
      rowCount: 3, command: '', oid: 0, fields: [],
    }));
    const context = { mode: 'write', signal: new AbortController().signal, deadline: Date.now() + 5_000 } as WriteTransactionContext;
    const service = new ListingWithdrawal();
    const count = await pgTransactionState.run({ client: { query } as unknown as PoolClient, context, mode: 'write', open: true }, () =>
      service.qualification(context, {
        event: 'event:qualification:revoked', qualification: 'qualification:one', scope: 'mall:one',
        subjectKind: 'partner', subjectId: 'partner:one', productIds: ['product:one'], categoryIds: ['category:food'], regionIds: [],
      })
    );
    expect(count).toBe(3);
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[0]?.[0]).toContain("update catalog.listing listing set status='unpublished'");
    expect(query.mock.calls[0]?.[0]).not.toContain('runtime.');
    expect(query.mock.calls[0]?.[1]).toEqual(['mall:one', ['product:one'], ['category:food'], 'partner', false, 'partner:one']);
    expect(query.mock.calls[1]?.[0]).toContain('jsonb_to_recordset');
    expect(JSON.parse(String(query.mock.calls[1]?.[1]?.[0]))).toHaveLength(3);
  });

  it('treats a region qualification as scope-wide risk without building per-row application loops', async () => {
    const query = vi.fn(async (_sql: string, _values?: readonly unknown[]) => ({ rows: [], rowCount: 0, command: '', oid: 0, fields: [] }));
    const context = { mode: 'write', signal: new AbortController().signal, deadline: Date.now() + 5_000 } as WriteTransactionContext;
    await pgTransactionState.run({ client: { query } as unknown as PoolClient, context, mode: 'write', open: true }, () =>
      new ListingWithdrawal().qualification(context, {
        event: 'event:qualification:expired', qualification: 'qualification:region', scope: 'mall:one',
        subjectKind: 'region', subjectId: 'region:cn31', productIds: [], categoryIds: [], regionIds: ['region:cn31'],
      })
    );
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0]?.[1]?.[4]).toBe(true);
  });
});
