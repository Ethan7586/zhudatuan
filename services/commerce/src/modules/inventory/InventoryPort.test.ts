import { describe, expect, it } from 'vitest';
import type { QueryResult } from 'pg';
import { InventoryPort } from './InventoryPort';

describe('inventory reservation locking', () => {
  it('locks stock rows before aggregating reservations', async () => {
    const queries: string[] = [];
    const database = {
      query: async (text: string) => {
        queries.push(text);
        const rows = text.startsWith('with locked as') ? [{ id: 'stock:1', onhand: 10, safety: 1, reserved: 2 }] : [];
        return { rows, rowCount: rows.length } as unknown as QueryResult;
      },
    };
    await new InventoryPort().reserve(database, 'order:1', 'mall:1', [{ sku: 'sku:1', listing: 'listing:1', stockitem: 'stock:1', quantity: 2, accepted: true }]);
    expect(queries[0]).toContain('order by array_position($1::text[],stock.id) for update');
    expect(queries[0]).not.toMatch(/group by[\s\S]*for update/i);
    expect(queries.filter((query) => query.startsWith('insert into inventory.reservation'))).toHaveLength(1);
  });
});
