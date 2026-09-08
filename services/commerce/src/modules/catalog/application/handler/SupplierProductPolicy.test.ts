import { describe, expect, it, vi } from 'vitest';
import { readHandlerContext } from '../../../../test/HandlerFixture';
import type { ProductRepository } from '../port/ProductRepository';
import { ProductsCreateHandler } from './ProductsCreateHandler';
import { ProductsUpdateHandler } from './ProductsUpdateHandler';

describe('supplier product policy', () => {
  it('binds a supplier draft to the authenticated supplier and ignores forged owner and brand', async () => {
    const create = vi
      .fn()
      .mockResolvedValue({
        id: 'product:one',
        scope_id: 'supplier:one',
        owner_partner_id: 'supplier:one',
        brand_id: null,
        category_id: 'category:food',
        title: '礼盒',
        product_type: 'physical',
        attributes: {},
        status: 'draft',
        version: 1,
        created_at: '2026-09-07T00:00:00Z',
        updated_at: '2026-09-07T00:00:00Z',
      });
    await new ProductsCreateHandler({ create } as unknown as ProductRepository).execute(
      { body: { owner: 'supplier:other', brand: 'brand:other', category: 'category:food', title: '礼盒' } } as never,
      supplierContext('catalog.products.create') as never
    );
    expect(create).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ scope: 'supplier:one', owner: 'supplier:one', brand: null }));
  });

  it('allows review submission but rejects direct activation and archival', async () => {
    const update = vi
      .fn()
      .mockResolvedValue({
        id: 'product:one',
        scope_id: 'supplier:one',
        owner_partner_id: 'supplier:one',
        brand_id: null,
        category_id: 'category:food',
        title: '礼盒',
        product_type: 'physical',
        attributes: {},
        status: 'review',
        version: 2,
        created_at: '2026-09-07T00:00:00Z',
        updated_at: '2026-09-07T00:00:00Z',
      });
    const handler = new ProductsUpdateHandler({ update } as unknown as ProductRepository);
    await handler.execute({ path: { productid: 'product:one' }, body: { status: 'review' } } as never, supplierContext('catalog.products.update') as never);
    expect(update).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ status: 'review', scope: 'supplier:one', expectedVersion: 3 }));
    await expect(handler.execute({ path: { productid: 'product:one' }, body: { status: 'active' } } as never, supplierContext('catalog.products.update') as never)).rejects.toMatchObject({ code: 'SCOPE_DENIED' });
    await expect(handler.execute({ path: { productid: 'product:one' }, body: { status: 'archived' } } as never, supplierContext('catalog.products.update') as never)).rejects.toMatchObject({ code: 'SCOPE_DENIED' });
    expect(update).toHaveBeenCalledOnce();
  });
});

function supplierContext(operation: 'catalog.products.create' | 'catalog.products.update') {
  const base = readHandlerContext(operation, {} as never, 'supplier:one');
  if (base.security.kind !== 'session') throw new Error('TEST_SESSION_REQUIRED');
  return {
    ...base,
    expectedVersion: 3,
    idempotencyKey: 'supplier-command:one',
    security: { kind: 'session', access: { ...base.security.access, actor: { ...base.security.access.actor, target: 'supplier' }, scope: { id: 'supplier:one', kind: 'supplier', path: [] } } },
  };
}
