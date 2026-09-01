import { describe, expect, it, vi } from 'vitest';
import type { PgTransactionAccess, SqlExecutor } from '../../../../adapter/database/PgTransactionAccess';
import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import { PgCartRepository } from './PgCartRepository';

function database(rows: ReadonlyArray<ReadonlyArray<Record<string, unknown>>>): SqlExecutor {
  let index = 0;
  return { query: vi.fn(async () => ({ rows: [...(rows[index++] ?? [])], rowCount: 0, command: '', oid: 0, fields: [] })) } as unknown as SqlExecutor;
}

const context = {} as WriteTransactionContext;
function repository(target: SqlExecutor): PgCartRepository {
  return new PgCartRepository({ database: () => target } as unknown as PgTransactionAccess);
}

describe('PgCartRepository', () => {
  it('rejects a stale cart version after locking the active cart', async () => {
    const target = database([[{ id: 'cart:1', version: 4 }]]);
    await expect(repository(target).lockOrCreate(context, 'member:1', 'mall:1', 'app:1', 3)).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
  });

  it('locks line versions in stable listing order', async () => {
    const target = database([
      [
        { listing_id: 'listing:a', version: 2 },
        { listing_id: 'listing:b', version: 3 },
      ],
    ]);
    await repository(target).lineVersions(context, 'cart:1', ['listing:b', 'listing:a']);
    expect(target.query).toHaveBeenCalledWith(expect.stringContaining('order by listing_id for update'), ['cart:1', ['listing:a', 'listing:b']]);
  });

  it('mutates a whole batch in one CTE and increments the cart exactly once', async () => {
    const target = database([[{ listing_id: 'listing:a' }, { listing_id: 'listing:b' }], []]);
    await repository(target).mutate(context, 'cart:1', [
      { listing: 'listing:a', quantity: 2, version: 1, sku: 'sku:a', title: 'A', listingVersion: '7', unitMinor: 100, currency: 'CNY', priceVersion: 'price:1' },
      { listing: 'listing:b', quantity: 0, version: 0, sku: '', title: '', listingVersion: '', unitMinor: 0, currency: '', priceVersion: '' },
    ]);
    expect(target.query).toHaveBeenCalledTimes(2);
    expect(target.query).toHaveBeenNthCalledWith(1, expect.stringMatching(/removed as[\s\S]*updated as[\s\S]*inserted as/), expect.any(Array));
    expect(target.query).toHaveBeenNthCalledWith(2, expect.stringContaining('version=version+1'), ['cart:1']);
  });
});
