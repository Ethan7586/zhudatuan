import { describe, expect, it, vi } from 'vitest';
import type { WriteTransactionContext } from '../../platform/database/TransactionContext';
import { listingPublishedEvent } from '../../modules/catalog/domain/event/CatalogEvents';
import type { ListingSnapshot } from '../../modules/catalog/domain/model/Listing';
import { PgTransactionalOutbox } from './PgTransactionalOutbox';
import type { PgTransactionAccess, SqlExecutor } from './PgTransactionAccess';

describe('PgTransactionalOutbox', () => {
  it('validates and inserts a publication event batch with one database round trip', async () => {
    const query = vi.fn(async (_sql: string, _values?: readonly unknown[]) => ({ rows: [], rowCount: 2 }));
    const access = { database: () => ({ query }) as unknown as SqlExecutor } as unknown as PgTransactionAccess;
    const outbox = new PgTransactionalOutbox(access);
    await outbox.appendMany({} as WriteTransactionContext, [
      listingPublishedEvent(listing('listing:one', 2), { actor: 'principal:one', trace: 'trace:batch' }),
      listingPublishedEvent(listing('listing:two', 3), { actor: 'principal:one', trace: 'trace:batch' }),
    ]);

    expect(query).toHaveBeenCalledOnce();
    expect(String(query.mock.calls[0]?.[0])).toContain('jsonb_to_recordset');
    expect(JSON.parse(String(query.mock.calls[0]?.[1]?.[0]))).toHaveLength(2);
  });
});

function listing(id: string, version: number): ListingSnapshot {
  return Object.freeze({ id, scope: 'mall:one', pool: 'pool:one', sku: `sku:${id}`, title: id, state: 'published', effectiveAt: '2026-09-05T00:00:00.000Z', expiresAt: null, version });
}
