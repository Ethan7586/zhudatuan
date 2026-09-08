import { describe, expect, it, vi } from 'vitest';
import type { OperationOutputFor } from '@shop/contract';
import { CatalogGateway } from './infrastructure/CatalogGateway';
import { mapCatalog } from './infrastructure/CatalogMapper';
import { toFrontendCategories, toFrontendProducts } from './viewmodel/CatalogPresentation';
import { mapProductDetail, productAvailability, selectProductSku } from '../../entity/product';
import { ProductGateway } from '../product/infrastructure/ProductGateway';

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
          qualification: { eligible: true, policyVersion: 4 },
          saleability: { state: 'saleable', reasons: [] },
        },
      ],
      categories: [{ id: 'category:food', code: 'cat_food', name: '食品饮料', count: 1 }],
      nextCursor: null,
      version: 'catalog:7',
      asOf: '2026-08-31T00:00:00.000Z',
    };
    const page = mapCatalog(input);
    expect(page.items[0]?.product).toMatchObject({
      priceWelfareMinor: 8899,
      priceMarketMinor: 10999,
      stock: 8,
      listingId: 'listing:one',
      productId: 'product:one',
      saleability: { state: 'saleable', reasons: [] },
      categoryId: 'category:food',
      categoryName: '食品饮料',
      supplierId: 'supplier:one',
      allowedAccounts: ['welfare'],
      deliverySla: '供应商承诺两日内发货',
    });
    expect(toFrontendProducts(page.items.map(({ product }) => product))[0]).toMatchObject({ price: 88.99, originalPrice: 109.99 });
    expect(toFrontendCategories(page.categories)).toEqual([{ id: 'category:food', code: 'cat_food', name: '食品饮料', count: 1, iconName: 'UtensilsCrossed', description: '1 件可见商品' }]);
  });

  it('aggregates every listing SKU and switches all authoritative availability fields together', () => {
    const first = catalog().items[0]!;
    const blocked = { ...first, id: 'listing:small', sku: 'sku:small', specifications: { 规格: '小份' }, price: null, availability: { sku: 'sku:small', available: 0, state: 'unavailable' as const, version: 'stock:small' }, qualification: { eligible: false, policyVersion: 5 }, saleability: { state: 'blocked' as const, reasons: ['qualification_failed' as const, 'price_unavailable' as const, 'out_of_stock' as const] } };
    const saleable = { ...first, id: 'listing:large', sku: 'sku:large', specifications: { 规格: '大份' }, price: { sku: 'sku:large', amountMinor: 12800, compareMinor: 15800, currency: 'CNY', version: 'price:large' }, availability: { sku: 'sku:large', available: 9, state: 'available' as const, version: 'stock:large' } };
    const product = mapProductDetail([blocked, saleable])!;

    expect(product).toMatchObject({ productId: 'product:one', listingId: 'listing:large', skuId: 'sku:large', priceWelfareMinor: 12800, stock: 9, skus: [{ id: 'sku:small' }, { id: 'sku:large' }] });
    const selected = selectProductSku(product, 'sku:small');
    expect(selected).toMatchObject({ listingId: 'listing:small', priceWelfareMinor: 0, stock: 0, saleability: { state: 'blocked' } });
    expect(productAvailability(selected)).toMatchObject({ canPurchase: false, actionButtonStateText: '当前商品不满足经营资格要求' });
  });
});

describe('storefront catalog gateway', () => {
  it('maps domain filters to the exact HTTP contract once', async () => {
    const catalogRead = vi.fn(() => Promise.resolve({ items: [], categories: [], nextCursor: null, version: 'catalog:1', asOf: '2026-09-03T00:00:00.000Z' }));
    const gateway = new CatalogGateway({ catalogRead } as never, (() => Object.freeze({ headers: Object.freeze({}) })) as never);
    await gateway.read({ listingIds: ['listing:one', 'listing:one', 'listing:two'], query: '关怀礼盒', limit: 20 });
    expect(catalogRead).toHaveBeenCalledWith(
      { query: { listingIds: 'listing:one,listing:two', q: '关怀礼盒', limit: 20 } },
      expect.objectContaining({ headers: {} })
    );
  });

  it('loads all SKU listings for a product detail without a mock fallback', async () => {
    const value = catalog();
    const catalogRead = vi.fn(() => Promise.resolve(value));
    const gateway = new ProductGateway({ catalogRead } as never, (() => Object.freeze({ headers: Object.freeze({}) })) as never);
    await expect(gateway.read('product:one')).resolves.toMatchObject({ productId: 'product:one' });
    expect(catalogRead).toHaveBeenCalledWith({ query: { productId: 'product:one', limit: 50 } }, expect.objectContaining({ headers: {} }));
  });
});

function catalog(): OperationOutputFor<'storefront.catalog.read'> {
  return {
    items: [{ id: 'listing:one', sku: 'sku:one', product: 'product:one', title: '企业福利商品', subtitle: null, coverUrl: null, kind: 'physical', attributes: { detail: { allowedAccounts: ['welfare'] } }, specifications: { 规格: '标准' }, category: { id: 'category:food', code: 'cat_food', name: '食品饮料' }, brandId: 'brand:one', supplierId: 'supplier:one', version: '1', updatedAt: '2026-09-04T00:00:00.000Z', price: { sku: 'sku:one', amountMinor: 8800, compareMinor: 9900, currency: 'CNY', version: 'price:1' }, availability: { sku: 'sku:one', available: 6, state: 'available', version: 'stock:1' }, qualification: { eligible: true, policyVersion: 4 }, saleability: { state: 'saleable', reasons: [] } }],
    categories: [{ id: 'category:food', code: 'cat_food', name: '食品饮料', count: 1 }],
    nextCursor: null,
    version: 'catalog:one',
    asOf: '2026-09-04T00:00:00.000Z',
  };
}
