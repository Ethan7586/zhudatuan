import { describe, expect, it, vi } from 'vitest';
import { result, withWriteTransaction } from '../../../../test/TransactionFixture';
import { PgInventoryReturnPort } from './PgInventoryReturnPort';

describe('PgInventoryReturnPort', () => {
  it('restocks only accepted return lines instead of the complete fulfillment', async () => {
    const query = vi.fn(async (sql: string) => {
      expect(sql).toContain('join fulfillment.returnline line');
      expect(sql).not.toContain('join fulfillment.line line');
      return result([{ order: 'order:one', location: 'store:one', line: 'line:one', quantity: 1 }]);
    });
    const orders = {
      snapshot: vi.fn(async () => ({ id: 'order:one', scope: 'mall:one', member: 'member:one' })),
      lineSkus: vi.fn(async () => [{ line: 'line:one', sku: 'sku:one', product: 'product:one' }]),
    };
    const port = new PgInventoryReturnPort(orders as never);
    const value = await withWriteTransaction(query, (context) => port.restock(context, 'return:one'));
    expect(value).toEqual({ reference: 'return:one', scope: 'mall:one', location: 'store:one', lines: [{ line: 'line:one', sku: 'sku:one', quantity: 1 }] });
  });
});
