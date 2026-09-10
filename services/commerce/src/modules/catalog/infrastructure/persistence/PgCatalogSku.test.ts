import { describe, expect, it, vi } from 'vitest';
import { result, withReadTransaction } from '../../../../test/TransactionFixture';
import { PgCatalogSku } from './PgCatalogSku';

describe('PgCatalogSku', () => {
  it('accepts inventory references from products owned, listed or sourced in the exact scope', async () => {
    const query = vi.fn(async (_sql: string, _values?: readonly unknown[]) => result([{ id: 'sku:one' }]));
    const sku = new PgCatalogSku();

    await expect(withReadTransaction(query, (context) => sku.find(context, 'mall:one', 'MEAL-1'))).resolves.toBe('sku:one');

    const sql = String(query.mock.calls[0]?.[0]);
    expect(sql).toContain('product.owner_partner_id=$2');
    expect(sql).toContain('from catalog.listing listing where listing.sku_id=sku.id and listing.scope_id=$2');
    expect(sql).toContain('from catalog.sourcelisting source where source.sku_id=sku.id and source.scope_id=$2');
    expect(query.mock.calls[0]?.[1]).toEqual(['MEAL-1', 'mall:one']);
  });

  it('does not resolve a reference that has no inventory relationship with the scope', async () => {
    const query = vi.fn(async (_sql: string, _values?: readonly unknown[]) => result([]));
    const sku = new PgCatalogSku();

    await expect(withReadTransaction(query, (context) => sku.find(context, 'mall:other', 'MEAL-1'))).resolves.toBeNull();
  });
});
