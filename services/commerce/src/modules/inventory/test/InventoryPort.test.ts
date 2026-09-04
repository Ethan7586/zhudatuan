import { describe, expect, it, vi } from 'vitest';
import type { QueryResult } from 'pg';
import { InventoryPort } from '../infrastructure/persistence/InventoryPort';
import { result, withWriteTransaction } from '../../../test/TransactionFixture';

describe('inventory reservation locking', () => {
  it('locks stock rows before aggregating reservations', async () => {
    const queries: string[] = [];
    const database = {
      query: async (text: string) => {
        queries.push(text);
        if (text.startsWith('select exists(select 1 from runtime.jobs')) return result([{ existing: false, depth: 0 }]);
        if (text.startsWith('with locked as')) return result([{ id: 'stock:1', scope_id: 'mall:1', sku_id: 'sku:1', location_id: 'warehouse:1',
          onhand: 10, safety: 1, reserved: 2, version: 1, status: 'active', updated_at: new Date('2026-09-05T00:00:00.000Z') }]);
        if (text.startsWith('update inventory.stockitem target')) return result([{ id: 'stock:1' }]);
        return result([]);
      },
    };
    await withWriteTransaction(database.query, (context) => new InventoryPort().reserve(context, 'order:1', 'mall:1', [{ sku: 'sku:1', listing: 'listing:1', stockitem: 'stock:1', quantity: 2, accepted: true }]));
    const stockLock = queries.find((query) => query.startsWith('with locked as'))!;
    expect(stockLock).toContain('order by stock.id for update');
    expect(stockLock).not.toMatch(/group by[\s\S]*for update/i);
    expect(queries.filter((query) => query.startsWith('insert into inventory.reservation'))).toHaveLength(1);
  });

  it('treats a matching existing reservation as an idempotent replay', async () => {
    const queries: string[] = [];
    const database = {
      query: async (text: string) => {
        queries.push(text);
        if (text.startsWith('with locked as')) return result([{ id: 'stock:1', scope_id: 'mall:1', sku_id: 'sku:1', location_id: 'warehouse:1',
          onhand: 10, safety: 1, reserved: 2, version: 2, status: 'active', updated_at: new Date('2026-09-05T00:00:00.000Z') }]);
        if (text.startsWith('select id,stockitem_id')) return result([{ id: 'reservation:one', stockitem_id: 'stock:1', owner_type: 'order',
          owner_id: 'order:1', quantity: 2, state: 'reserved', expires_at: new Date('2026-09-05T00:30:00.000Z'),
          created_at: new Date('2026-09-05T00:00:00.000Z'), version: 1 }]);
        return result([]);
      },
    };
    await withWriteTransaction(database.query, (context) => new InventoryPort().reserve(context, 'order:1', 'mall:1', [
      { sku: 'sku:1', listing: 'listing:1', stockitem: 'stock:1', quantity: 2, accepted: true },
    ]));
    expect(queries).toHaveLength(2);
    expect(queries.some((query) => query.startsWith('insert into inventory.reservation'))).toBe(false);
  });

  it('ignores a duplicate provider source version without touching stock or emitting an event', async () => {
    const query = vi.fn(async (text: string, _values?: readonly unknown[]) => {
      if (text.startsWith('select stock.id')) return result([{ id: 'stock:1', scope_id: 'mall:1', sku_id: 'sku:1', location_id: 'warehouse:1',
        onhand: 10, safety: 1, reserved: 0, version: 2, status: 'active', updated_at: new Date('2026-09-05T00:00:00.000Z') }]);
      return result([]);
    });
    await withWriteTransaction(query, (context) => new InventoryPort().observe(context, { id: 'stock:1', scope: 'mall:1', sku: 'sku:1',
      location: 'warehouse:1', onhand: 10, safety: 1, provider: 'jdproduct', version: 'cursor:one' }));
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls.some(([text]) => String(text).includes('runtime.outbox'))).toBe(false);
  });
});
