import { describe, expect, it, vi } from 'vitest';
import { readHandlerContext } from '../../../../test/HandlerFixture';
import { OPERATION_SCHEMAS } from '@shop/contract';
import type { CatalogInventoryPort } from '../../../inventory/public';
import type { CatalogPricingPort } from '../../../pricing/public';
import type { CatalogQualificationPort } from '../../../qualification/public';
import type { ProductDetailBase, ProductRepository } from '../port/ProductRepository';
import { ProductDetailReadHandler } from './ProductDetailReadHandler';

describe('ProductDetailReadHandler', () => {
  it('isolates an unavailable inventory partition without calling unrelated dependencies', async () => {
    const products = repository();
    const inventory = {
      stock: vi.fn(async () => {
        throw new Error('inventory offline');
      }),
    } as unknown as CatalogInventoryPort;
    const pricing = { prices: vi.fn() } as unknown as CatalogPricingPort;
    const qualifications = { decisions: vi.fn() } as unknown as CatalogQualificationPort;
    const handler = new ProductDetailReadHandler(products, inventory, pricing, qualifications, organizations, media);

    const reply = await handler.execute({ path: { productid: 'product:one' }, query: { section: 'inventory' }, body: {} } as never, readHandlerContext('catalog.product.detail.read', {} as never));

    expect(reply.body).toMatchObject({
      section: 'inventory',
      id: 'product:one',
      inventory: [],
      prices: [],
      qualifications: [],
      dependencies: {
        catalog: { state: 'ready', watermark: '7' },
        inventory: { state: 'unavailable' },
        pricing: { state: 'notrequested' },
        qualification: { state: 'notrequested' },
      },
      gaps: [{ dependency: 'inventory', code: 'DEPENDENCY_UNAVAILABLE' }],
    });
    expect(inventory.stock).toHaveBeenCalledOnce();
    expect(pricing.prices).not.toHaveBeenCalled();
    expect(qualifications.decisions).not.toHaveBeenCalled();
  });

  it('loads qualification decisions as their own retryable partition', async () => {
    const qualifications = { decisions: vi.fn(async () => [{ listing: 'listing:one', eligible: false, policyVersion: 4 }]) } as CatalogQualificationPort;
    const handler = new ProductDetailReadHandler(repository(), { stock: vi.fn() } as unknown as CatalogInventoryPort, { prices: vi.fn() } as unknown as CatalogPricingPort, qualifications, organizations, media);

    const reply = await handler.execute({ path: { productid: 'product:one' }, query: { section: 'qualification' }, body: {} } as never, readHandlerContext('catalog.product.detail.read', {} as never));

    expect(reply.body).toMatchObject({
      section: 'qualification',
      qualifications: [{ listing: 'listing:one', eligible: false, policyVersion: 4 }],
      dependencies: { qualification: { state: 'ready', watermark: '4' } },
    });
    expect(qualifications.decisions).toHaveBeenCalledWith(expect.anything(), expect.any(String), [{ listing: 'listing:one', product: 'product:one', category: 'category:food', partner: null, regions: ['region:east'] }]);
  });

  it('projects the rich inventory port model into the strict product detail contract', async () => {
    const inventory = {
      stock: vi.fn(async () => [
        {
          sku: 'sku:one',
          scope: 'mall:one',
          location: 'warehouse:one',
          onhand: '12',
          safety: '2',
          reserved: '1',
          status: 'active',
          version: '3',
          watermark: new Date('2026-09-07T08:00:00.000Z'),
        },
      ]),
    } as unknown as CatalogInventoryPort;
    const handler = new ProductDetailReadHandler(repository(), inventory, { prices: vi.fn() } as unknown as CatalogPricingPort, { decisions: vi.fn() } as unknown as CatalogQualificationPort, organizations, media);

    const reply = await handler.execute({ path: { productid: 'product:one' }, query: { section: 'inventory' }, body: {} } as never, readHandlerContext('catalog.product.detail.read', {} as never));

    expect(reply.body.inventory).toEqual([
      {
        sku: 'sku:one',
        skuCode: 'MEAL-1',
        scope: 'mall:one',
        scopeName: '员工福利商城',
        location: 'warehouse:one',
        locationName: '商品仓库',
        onhand: '12',
        safety: '2',
        status: 'active',
        version: '3',
      },
    ]);
    expect(reply.body.inventory[0]).not.toHaveProperty('reserved');
    expect(reply.body.inventory[0]).not.toHaveProperty('watermark');
    expect(() => OPERATION_SCHEMAS['catalog.product.detail.read'].output.parse(reply.body)).not.toThrow();
  });

  it('projects an opaque cover object as a fresh signed image without exposing the reference', async () => {
    const products = {
      detail: vi.fn(async () => ({ ...detail, cover_object: 'object:cover', cover_url: null })),
    } as unknown as ProductRepository;
    const links = vi.fn(async () => new Map([['object:cover', 'http://127.0.0.1:3001/objects/signed-cover']]));
    const handler = new ProductDetailReadHandler(
      products,
      { stock: vi.fn() } as unknown as CatalogInventoryPort,
      { prices: vi.fn() } as unknown as CatalogPricingPort,
      { decisions: vi.fn() } as unknown as CatalogQualificationPort,
      organizations,
      { links }
    );

    const reply = await handler.execute({ path: { productid: 'product:one' }, query: { section: 'core' }, body: {} } as never, readHandlerContext('catalog.product.detail.read', {} as never));

    expect(links).toHaveBeenCalledWith(['object:cover']);
    expect(reply.body).toMatchObject({
      cover_url: 'http://127.0.0.1:3001/objects/signed-cover',
      media: [{ id: 'media:cover', kind: 'image', url: 'http://127.0.0.1:3001/objects/signed-cover', alt: '早餐', sort: 0 }],
    });
    expect(reply.body).not.toHaveProperty('cover_object');
    expect(() => OPERATION_SCHEMAS['catalog.product.detail.read'].output.parse(reply.body)).not.toThrow();
  });
});

function repository(): ProductRepository {
  return {
    detail: vi.fn(async () => detail),
  } as unknown as ProductRepository;
}

const detail: ProductDetailBase = Object.freeze({
  id: 'product:one',
  title: '早餐',
  description: '工作日早餐套餐',
  product_type: 'physical',
  status: 'active',
  version: '7',
  category_id: 'category:food',
  category_name: '餐饮美食',
  brand_id: null,
  brand_name: null,
  owner_partner_id: null,
  owner_partner_name: null,
  cover_object: null,
  cover_url: null,
  subtitle: null,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-07T00:00:00.000Z',
  regionIds: Object.freeze(['region:east']),
  skus: Object.freeze([{ id: 'sku:one', code: 'MEAL-1', status: 'active', specifications: Object.freeze([]), version: 2 }]),
  listings: Object.freeze([
    {
      id: 'listing:one',
      scope: 'mall:one',
      pool: 'pool:one',
      poolName: '早餐池',
      sku: 'sku:one',
      skuCode: 'MEAL-1',
      title: '早餐',
      status: 'published',
      effectiveAt: '2026-09-01T00:00:00.000Z',
      expiresAt: null,
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-07T00:00:00.000Z',
      version: 3,
    },
  ]),
  media: Object.freeze([]),
  channels: Object.freeze([]),
  pools: Object.freeze([{ id: 'pool:one', name: '早餐池', kind: 'private' as const, status: 'active' as const, listingCount: 1 }]),
  timeline: Object.freeze([]),
  visibleScopes: Object.freeze(['mall:one']),
});

const organizations = {
  summaries: vi.fn(async () => [{ id: 'mall:one', name: '员工福利商城', kind: 'mall' }]),
};

const media = {
  links: vi.fn(async () => new Map<string, string>()),
};
