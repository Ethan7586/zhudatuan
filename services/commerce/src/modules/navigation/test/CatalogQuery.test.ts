import { describe, expect, it } from 'vitest';
import type { OperationInputFor } from '@shop/contract';
import type { HandlerContext } from '../../../pipeline/HandlerContext';
import type { CatalogReadPort, StorefrontListing } from '../../catalog/public/CatalogReadPort';
import type { ExperienceReadPort } from '../../experience/public/ExperienceReadPort';
import type { InventoryReadPort } from '../../inventory/public/InventoryReadPort';
import type { PricingReadPort } from '../../pricing/public/PricingReadPort';
import type { CatalogQualificationPort } from '../../qualification/public';
import { CatalogMapper } from '../application/service/CatalogMapper';
import { CatalogQuery } from '../application/service/CatalogQuery';

describe('storefront catalog query', () => {
  it('reads the exact deduplicated cart listing set and composes public read ports', async () => {
    let selected: readonly string[] | null = null;
    const catalog: CatalogReadPort = {
      categories: async () => Object.freeze([{ id: 'category:one', code: 'cat_food', name: '食品饮料', count: 1 }]),
      listings: async (_scope, input) => {
        selected = input.listings;
        return Object.freeze({
          items: Object.freeze([listing()]),
          next: null,
        });
      },
    };
    const query = createQuery(catalog);
    const result = await query.execute(input({ listingIds: 'listing:one,listing:one,listing:two', limit: '50' }), context());
    expect(selected).toEqual(['listing:one', 'listing:two']);
    expect(result.body).toMatchObject({
      categories: [],
      items: [{ category: { id: 'category:one', code: 'cat_food', name: '食品饮料' }, price: { amountMinor: 8800 }, availability: { available: 6 }, qualification: { eligible: true }, saleability: { state: 'saleable', reasons: [] } }],
    });
  });

  it('rejects a batch selector combined with cursor or search filters', async () => {
    const query = createQuery({ categories: async () => Object.freeze([]), listings: async () => Object.freeze({ items: Object.freeze([]), next: null }) });
    await expect(query.execute(input({ listingIds: 'listing:one', q: '冲突' }), context())).rejects.toThrow('STOREFRONT_CATALOG_FILTER_CONFLICT');
  });

  it('returns authoritative category facets for a browsable catalog query', async () => {
    const query = createQuery({ categories: async () => Object.freeze([{ id: 'category:one', code: 'cat_food', name: '食品饮料', count: 6 }]), listings: async () => Object.freeze({ items: Object.freeze([]), next: null }) });
    const result = await query.execute(input({}), context());
    expect(result.body.categories).toEqual([{ id: 'category:one', code: 'cat_food', name: '食品饮料', count: 6 }]);
  });

  it('returns explicit non-saleable reasons when an authoritative dependency is unavailable', () => {
    const mapper = new CatalogMapper('catalog-query-test-secret-key-000001');
    const rows = mapper.items([listing()], [], [], [], { pricing: false, inventory: false, qualification: false });
    expect(rows[0]).toMatchObject({ qualification: null, saleability: { state: 'blocked', reasons: ['qualification_unavailable', 'price_unavailable', 'inventory_unavailable'] } });
  });
});

function listing(): StorefrontListing {
  return Object.freeze({
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
  });
}

function createQuery(catalog: CatalogReadPort): CatalogQuery {
  const experience: ExperienceReadPort = {
    resolveEntry: async () =>
      Object.freeze({
        application: 'application:one',
        handle: 'mall-one',
        url: 'https://yengze.press/s/mall-one',
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
    publishedFor: async () => null,
  };
  const pricing: PricingReadPort = {
    prices: async () => Object.freeze([{ sku: 'sku:one', amountMinor: 8800, compareMinor: 9900, currency: 'CNY', version: 'price:1' }]),
    offers: async () => Object.freeze([]),
  };
  const inventory: InventoryReadPort = {
    availability: async () => Object.freeze([{ sku: 'sku:one', available: 6, state: 'available', version: 'stock:1' }]),
    details: async () => Object.freeze([]),
  };
  const qualification: CatalogQualificationPort = {
    decisions: async (_context, _scope, subjects) => Object.freeze(subjects.map(({ listing }) => Object.freeze({ listing, eligible: true, policyVersion: 4 }))),
  };
  return new CatalogQuery(experience, catalog, pricing, inventory, qualification, new CatalogMapper('catalog-query-test-secret-key-000001'));
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
