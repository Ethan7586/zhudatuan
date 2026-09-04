import { describe, expect, it, vi } from 'vitest';
import type { PgTransactionAccess, SqlExecutor } from '../../../../adapter/database/PgTransactionAccess';
import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import { PgListingRepository } from './PgListingRepository';

const context = {} as WriteTransactionContext;

describe('PgListingRepository publication persistence', () => {
  it('loads all facet groups with one bounded catalog query', async () => {
    const query = vi.fn(async (_sql: string, _values?: readonly unknown[]) => ({
      rows: [{ categories: [{ value: 'category:food', label: '食品', count: '2' }], suppliers: [], malls: [{ value: 'mall:one', label: null, count: 2 }], statuses: [{ value: 'published', label: null, count: 1 }] }],
      rowCount: 1,
      command: '',
      oid: 0,
      fields: [],
    }));
    const database = { query } as unknown as SqlExecutor;
    const repository = new PgListingRepository({ database: () => database } as unknown as PgTransactionAccess, { visible: vi.fn(async () => ['mall:one']) } as never);
    const facets = await repository.facets(context, { scope: 'mall:one', scopeKind: 'mall', query: '早餐' });
    expect(facets).toMatchObject({ categories: [{ value: 'category:food', count: 2 }], malls: [{ value: 'mall:one', count: 2 }] });
    expect(query).toHaveBeenCalledOnce();
    expect(query.mock.calls[0]?.[1]).toEqual([['mall:one'], '早餐', false, 'mall:one']);
  });

  it('loads all publication facts under a listing lock', async () => {
    const query = vi.fn(async (sql: string) => ({
      rows: sql.includes('from catalog.listing listing')
        ? [
            {
              id: 'listing:one',
              scope_id: 'mall:one',
              pool_id: 'pool:one',
              sku_id: 'sku:one',
              title: '早餐',
              status: 'draft',
              effective_at: null,
              expires_at: null,
              version: 1,
              product_id: 'product:one',
              product_status: 'active',
              category_id: 'category:food',
              owner_partner_id: null,
              region_ids: [],
              sku_status: 'active',
              pool_ready: true,
              scope_ready: true,
              channel_ready: true,
            },
          ]
        : [],
      rowCount: 1,
      command: '',
      oid: 0,
      fields: [],
    }));
    const database = { query } as unknown as SqlExecutor;
    const value = new PgListingRepository({ database: () => database } as unknown as PgTransactionAccess, { visible: async () => ['mall:one'] } as never);
    const rows = await value.candidates(context, ['listing:one'], 'mall:one');
    expect(rows[0]).toMatchObject({ listing: { id: 'listing:one', version: 1 }, productState: 'active', poolReady: true });
    expect(String(query.mock.calls[0]?.[0])).toContain('for update of listing');
  });

  it('saves a batch with a version predicate and returns only rows that won the race', async () => {
    const query = vi.fn(async (_sql: string, _values?: readonly unknown[]) => ({
      rows: [{ id: 'listing:one', scope_id: 'mall:one', pool_id: 'pool:one', sku_id: 'sku:one', title: '早餐', status: 'published', version: 2 }],
      rowCount: 1,
      command: '',
      oid: 0,
      fields: [],
    }));
    const database = { query } as unknown as SqlExecutor;
    const value = new PgListingRepository({ database: () => database } as unknown as PgTransactionAccess, {} as never);
    const rows = await value.save(context, [{ id: 'listing:one', scope: 'mall:one', pool: 'pool:one', sku: 'sku:one', title: '早餐', state: 'published', effectiveAt: '2026-09-05T00:00:00.000Z', expiresAt: null, version: 2 }]);
    expect(rows[0]?.version).toBe(2);
    const payload = JSON.parse(String(query.mock.calls[0]?.[1]?.[0]));
    expect(payload[0]).toMatchObject({ id: 'listing:one', expectedVersion: 1, version: 2 });
  });

  it('moves an unpublished listing into an active visible pool under optimistic concurrency', async () => {
    const query = vi.fn(async (sql: string, _values?: readonly unknown[]) => {
      if (sql.startsWith('select id,sku_id')) return result([{ id: 'listing:one', sku_id: 'sku:one', scope_id: 'mall:one', status: 'unpublished' }]);
      if (sql.startsWith('select target.id')) return result([{ id: 'pool:two' }]);
      if (sql.startsWith('update catalog.listing')) return result([{ id: 'listing:one', scope_id: 'mall:one', pool_id: 'pool:two', sku_id: 'sku:one', title: '早餐', status: 'unpublished', version: 4 }]);
      return result([]);
    });
    const database = { query } as unknown as SqlExecutor;
    const repository = new PgListingRepository({ database: () => database } as unknown as PgTransactionAccess, { visible: async () => ['mall:one'] } as never);
    const changed = await repository.changePool(context, 'listing:one', 'mall:one', 'pool:two', 3);

    expect(changed).toMatchObject({ pool_id: 'pool:two', version: 4 });
    expect(query).toHaveBeenCalledTimes(4);
    expect(query.mock.calls[3]?.[1]).toEqual(['listing:one', 'pool:two', 3]);
  });

  it('requires unpublishing before changing a listing pool', async () => {
    const query = vi.fn(async () => result([{ id: 'listing:one', sku_id: 'sku:one', scope_id: 'mall:one', status: 'published' }]));
    const repository = new PgListingRepository({ database: () => ({ query }) as unknown as SqlExecutor } as unknown as PgTransactionAccess, { visible: async () => ['mall:one'] } as never);
    await expect(repository.changePool(context, 'listing:one', 'mall:one', 'pool:two', 3)).rejects.toMatchObject({ code: 'LISTING_NOT_PURCHASABLE' });
    expect(query).toHaveBeenCalledOnce();
  });
});

function result(rows: readonly Readonly<Record<string, unknown>>[]) {
  return { rows, rowCount: rows.length, command: '', oid: 0, fields: [] };
}
