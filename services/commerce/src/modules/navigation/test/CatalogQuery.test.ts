import { describe, expect, it } from 'vitest';
import type { OperationInputFor } from '@shop/contract';
import type { HandlerContext } from '../../../foundation/application/HandlerContext';
import type { CatalogReadPort } from '../../catalog/public/CatalogReadPort';
import type { ExperienceReadPort } from '../../experience/public/ExperienceReadPort';
import type { InventoryReadPort } from '../../inventory/public/InventoryReadPort';
import type { PricingReadPort } from '../../pricing/public/PricingReadPort';
import { CatalogMapper } from '../application/service/CatalogMapper';
import { CatalogQuery } from '../application/service/CatalogQuery';

describe('storefront catalog query', () => {
  it('reads the exact deduplicated cart listing set and composes public read ports', async () => {
    let selected: readonly string[] | null = null;
    const catalog: CatalogReadPort = {
      listings: async (_scope, input) => {
        selected = input.listings;
        return Object.freeze({
          items: Object.freeze([
            Object.freeze({
              id: 'listing:one',
              sku: 'sku:one',
              product: 'product:one',
              title: '商品',
              subtitle: null,
              coverUrl: null,
              kind: 'physical',
              categoryId: 'category:one',
              categoryCode: 'cat_food',
              categoryName: '食品饮料',
              brandId: 'brand:one',
              supplierId: 'supplier:one',
              attributes: Object.freeze({}),
              specifications: Object.freeze({}),
              version: '1',
              updatedAt: '2026-08-31T00:00:00.000Z',
            }),
          ]),
          next: null,
        });
      },
    };
    const query = createQuery(catalog);
    const result = await query.execute(input({ listingIds: 'listing:one,listing:one,listing:two', limit: '50' }), context());
    expect(selected).toEqual(['listing:one', 'listing:two']);
    expect(result.body).toMatchObject({ items: [{ category: { id: 'category:one', code: 'cat_food', name: '食品饮料' }, price: { amountMinor: 8800 }, availability: { available: 6 } }] });
  });

  it('rejects a batch selector combined with cursor or search filters', async () => {
    const query = createQuery({ listings: async () => Object.freeze({ items: Object.freeze([]), next: null }) });
    await expect(query.execute(input({ listingIds: 'listing:one', q: '冲突' }), context())).rejects.toThrow('STOREFRONT_CATALOG_FILTER_CONFLICT');
  });
});

function createQuery(catalog: CatalogReadPort): CatalogQuery {
  const experience: ExperienceReadPort = {
    resolveEntry: async () =>
      Object.freeze({
        application: 'application:one',
        handle: 'mall-one',
        url: 'https://fufu.wang/s/mall-one',
        mall: 'mall:one',
        pool: 'pool:one',
        release: 'release:one',
        version: 'version:1',
        tenant: 'tenant:one',
        contentHash: 'hash:one',
        objectKey: 'experience/mall-one/hash.json',
      }),
    published: async () => {
      throw new Error('NOT_USED');
    },
  };
  const pricing: PricingReadPort = { prices: async () => Object.freeze([{ sku: 'sku:one', amountMinor: 8800, compareMinor: 9900, currency: 'CNY', version: 'price:1' }]) };
  const inventory: InventoryReadPort = { availability: async () => Object.freeze([{ sku: 'sku:one', available: 6, state: 'available', version: 'stock:1' }]) };
  return new CatalogQuery(experience, catalog, pricing, inventory, new CatalogMapper('catalog-query-test-secret-key-000001'));
}

function input(query: Readonly<Record<string, string>>): OperationInputFor<'storefront.catalog.read'> {
  return Object.freeze({ path: Object.freeze({}), query }) as OperationInputFor<'storefront.catalog.read'>;
}

function context(): HandlerContext<'storefront.catalog.read'> {
  return Object.freeze({
    operation: 'storefront.catalog.read',
    requestId: 'request:catalog-query',
    traceId: 'trace:catalog-query',
    deadline: Date.now() + 5_000,
    signal: new AbortController().signal,
    headers: Object.freeze({ 'x-storefront-handle': 'mall-one' }),
    rawBody: '',
    publicActor: 'public:storefront',
    security: Object.freeze({ kind: 'anonymous', channel: 'public', target: 'storefront', trace: 'trace:catalog-query' }),
    transaction: Object.freeze({}) as never,
  });
}
