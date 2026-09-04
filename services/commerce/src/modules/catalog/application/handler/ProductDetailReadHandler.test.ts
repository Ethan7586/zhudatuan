import { describe, expect, it, vi } from 'vitest';
import { readHandlerContext } from '../../../../test/HandlerFixture';
import type { CatalogInventoryPort } from '../../../inventory/public';
import type { CatalogPricingPort } from '../../../pricing/public';
import type { CatalogQualificationPort } from '../../../qualification/public';
import type { ProductDetailBase, ProductRepository } from '../port/ProductRepository';
import { ProductDetailReadHandler } from './ProductDetailReadHandler';

describe('ProductDetailReadHandler', () => {
  it('isolates an unavailable inventory partition without calling unrelated dependencies', async () => {
    const products = repository();
    const inventory = { stock: vi.fn(async () => { throw new Error('inventory offline'); }) } as unknown as CatalogInventoryPort;
    const pricing = { prices: vi.fn() } as unknown as CatalogPricingPort;
    const qualifications = { decisions: vi.fn() } as unknown as CatalogQualificationPort;
    const handler = new ProductDetailReadHandler(products, inventory, pricing, qualifications);

    const reply = await handler.execute(
      { path: { productid: 'product:one' }, query: { section: 'inventory' }, body: {} } as never,
      readHandlerContext('catalog.product.detail.read', {} as never)
    );

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
    const handler = new ProductDetailReadHandler(repository(), { stock: vi.fn() } as unknown as CatalogInventoryPort, { prices: vi.fn() } as unknown as CatalogPricingPort, qualifications);

    const reply = await handler.execute(
      { path: { productid: 'product:one' }, query: { section: 'qualification' }, body: {} } as never,
      readHandlerContext('catalog.product.detail.read', {} as never)
    );

    expect(reply.body).toMatchObject({
      section: 'qualification',
      qualifications: [{ listing: 'listing:one', eligible: false, policyVersion: 4 }],
      dependencies: { qualification: { state: 'ready', watermark: '4' } },
    });
    expect(qualifications.decisions).toHaveBeenCalledWith(expect.anything(), expect.any(String), [
      { listing: 'listing:one', product: 'product:one', category: 'category:food', partner: null, regions: ['region:east'] },
    ]);
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
  brand_id: null,
  owner_partner_id: null,
  cover_url: null,
  subtitle: null,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-07T00:00:00.000Z',
  regionIds: Object.freeze(['region:east']),
  skus: Object.freeze([{ id: 'sku:one', code: 'MEAL-1', status: 'active', specifications: Object.freeze([]), version: 2 }]),
  listings: Object.freeze([{ id: 'listing:one', scope: 'mall:one', pool: 'pool:one', sku: 'sku:one', title: '早餐', status: 'published', effectiveAt: '2026-09-01T00:00:00.000Z', expiresAt: null, createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-07T00:00:00.000Z', version: 3 }]),
  media: Object.freeze([]),
  channels: Object.freeze([]),
  pools: Object.freeze([{ id: 'pool:one', name: '早餐池', kind: 'private' as const, status: 'active' as const, listingCount: 1 }]),
  timeline: Object.freeze([]),
  visibleScopes: Object.freeze(['mall:one']),
});
