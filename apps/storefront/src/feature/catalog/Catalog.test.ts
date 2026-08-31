import { describe, expect, it } from 'vitest';
import type { OperationOutputFor } from '@shop/contract';
import { mapCatalog, toFrontendProducts } from './infrastructure/CatalogMapper';

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
