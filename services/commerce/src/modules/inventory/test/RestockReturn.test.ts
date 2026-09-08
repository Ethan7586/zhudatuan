import { describe, expect, it, vi } from 'vitest';
import { PgRestockRepository } from '../infrastructure/persistence/PgRestockRepository';
import { result, withWriteTransaction } from '../../../test/TransactionFixture';

describe('return restock', () => {
  it('appends one idempotent return movement, restores onhand and publishes the new balance', async () => {
    const query = vi.fn(async (text: string, _values?: readonly unknown[]) => {
      if (text.startsWith('with requested as'))
        return result([
          { stockitem_id: 'stock:one', quantity: 2, scope_id: 'mall:one', sku_id: 'sku:one', location_id: 'warehouse:one', onhand: 5, safety: 1, reserved: 1, status: 'active', version: 3, updated_at: new Date('2026-09-05T00:00:00.000Z') },
        ]);
      if (text.startsWith('insert into inventory.movement')) return result([{ id: 'movement:one' }]);
      if (text.startsWith('update inventory.stockitem')) return result([{ id: 'stock:one' }]);
      return result([]);
    });
    await withWriteTransaction(query, (context) => new PgRestockRepository().apply(context, { id: 'return:one', scope: 'mall:one', location: 'warehouse:one', lines: [{ line: 'line:one', sku: 'sku:one', quantity: 2 }] }));
    expect(query.mock.calls.find(([text]) => String(text).startsWith('update inventory.stockitem'))?.[1]).toEqual(['stock:one', 7, 4, expect.any(String), 3]);
    expect(query.mock.calls.some(([text, values]) => String(text).includes('runtime.outbox') && String(values).includes('inventory.stock.changed'))).toBe(true);
  });
});
