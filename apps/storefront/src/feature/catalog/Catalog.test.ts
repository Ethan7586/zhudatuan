import { describe, expect, it, vi } from 'vitest';
import type { OperationOutputFor } from '@shop/contract';
import { CatalogGateway } from './infrastructure/CatalogGateway';
import { mapCatalog } from './infrastructure/CatalogMapper';
import { toFrontendProducts } from './viewmodel/CatalogPresentation';

describe('storefront catalog mapping', () => {
  it('keeps authoritative minor amounts and converts only the presentation view', () => {
    const input: OperationOutputFor<'storefront.catalog.read'> = {
      items: [
        {
          id: 'listing:one',
          sku: 'sku:one',
          product: 'product:one',
          title: '企业福利商品',
          subtitle: null,
          coverUrl: null,
          kind: 'physical',
          attributes: { tags: ['热销'], detail: { allowedAccounts: ['welfare'], deliverySla: '供应商承诺两日内发货' } },
          specifications: { 包装: '礼盒' },
          category: { id: 'category:food', code: 'cat_food', name: '食品饮料' },
          brandId: 'brand:one',
          supplierId: 'supplier:one',
          version: '4',
          updatedAt: '2026-08-31T00:00:00.000Z',
          price: { sku: 'sku:one', amountMinor: 8899, compareMinor: 10999, currency: 'CNY', version: '3' },
          availability: { sku: 'sku:one', available: 8, state: 'available', version: '5' },
        },
      ],
      nextCursor: null,
      version: 'catalog:7',
      asOf: '2026-08-31T00:00:00.000Z',
    };
    const page = mapCatalog(input);
    expect(page.items[0]?.product).toMatchObject({
      priceWelfareMinor: 8899,
      priceMarketMinor: 10999,
      stock: 8,
      purchasable: true,
      categoryId: 'category:food',
      categoryName: '食品饮料',
      supplierId: 'supplier:one',
      allowedAccounts: ['welfare'],
      deliverySla: '供应商承诺两日内发货',
    });
    expect(toFrontendProducts(page.items.map(({ product }) => product))[0]).toMatchObject({ price: 88.99, originalPrice: 109.99 });
  });
});

describe('storefront catalog gateway', () => {
  it('maps domain filters to the exact HTTP contract once', async () => {
    const catalogRead = vi.fn(() => Promise.resolve({ items: [], nextCursor: null, version: 'catalog:1', asOf: '2026-09-03T00:00:00.000Z' }));
    const gateway = new CatalogGateway({ catalogRead } as never, (() => Object.freeze({ headers: Object.freeze({}) })) as never);
    await gateway.read({ listingIds: ['listing:one', 'listing:one', 'listing:two'], query: '关怀礼盒', limit: 20 });
    expect(catalogRead).toHaveBeenCalledWith(
      { query: { listingIds: 'listing:one,listing:two', q: '关怀礼盒', limit: 20 } },
      expect.objectContaining({ headers: {} })
    );
  });
});
