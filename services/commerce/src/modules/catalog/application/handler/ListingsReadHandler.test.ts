import { describe, expect, it, vi } from 'vitest';
import { readHandlerContext } from '../../../../test/HandlerFixture';
import type { CatalogInventoryPort } from '../../../inventory/public';
import type { CatalogPricingPort } from '../../../pricing/public';
import type { CatalogQualificationPort } from '../../../qualification/public';
import type { ListingRepository } from '../port/ListingRepository';
import { ListingsReadHandler } from './ListingsReadHandler';

const row = Object.freeze({
  id: 'listing:one',
  scope_id: 'mall:one',
  visible_scopes: ['mall:one'],
  pool_id: 'pool:one',
  pool_name: '员工福利池',
  sku_id: 'sku:one',
  product_id: 'product:one',
  title: '早餐',
  status: 'published',
  version: 2,
  cursor_sort: '2026-09-07T00:00:00.000Z',
  code: 'MEAL-1',
  product_type: 'physical',
  cover_url: null,
  subtitle: null,
  effective_at: null,
  expires_at: null,
  category_id: 'category:food',
  category_name: '食品',
  source: 'self',
  source_partner_id: null,
  sku_count: '1',
  sku_total: '2',
  mall_count: '1',
  mall_total: '3',
  region_ids: [],
});

describe('ListingsReadHandler', () => {
  it('returns one aggregate row with price, saleable stock, coverage and qualification gaps', async () => {
    const listings = { read: vi.fn(async () => [row]) } as unknown as ListingRepository;
    const inventory = { stock: vi.fn(async () => [{ sku: 'sku:one', scope: 'mall:one', onhand: '12', safety: '2', reserved: '1', status: 'active' }]) } as CatalogInventoryPort;
    const pricing = {
      prices: vi.fn(async () => [{ sku: 'sku:one', scope: 'mall:one', amountMinor: '9800', currency: 'CNY', bookStatus: 'active', effectiveAt: '2020-01-01T00:00:00.000Z', expiresAt: null, priceVersion: 3 }]),
    } as CatalogPricingPort;
    const qualifications = { decisions: vi.fn(async () => [{ listing: 'listing:one', eligible: false, policyVersion: 4 }]) } as CatalogQualificationPort;
    const reply = await new ListingsReadHandler(listings, inventory, pricing, qualifications).execute({ query: {} } as never, readHandlerContext('catalog.listings.read', {} as never));
    expect(reply.body.items[0]).toMatchObject({
      sku_count: 1,
      sku_total: 2,
      mall_count: 1,
      mall_total: 3,
      price_amount_minor: 9800,
      price_version: 3,
      price_currency: 'CNY',
      saleable_stock: 9,
      qualification_eligible: false,
      data_gaps: ['qualification_failed'],
    });
    expect(reply.body.items[0]).not.toHaveProperty('visible_scopes');
    expect(reply.body.items[0]).not.toHaveProperty('region_ids');
  });

  it('keeps the catalog row usable and reports each failed projection', async () => {
    const failure = async () => {
      throw new Error('projection unavailable');
    };
    const listings = { read: vi.fn(async () => [{ ...row, pool_id: null, pool_name: null }]) } as unknown as ListingRepository;
    const reply = await new ListingsReadHandler(listings, { stock: failure } as CatalogInventoryPort, { prices: failure } as CatalogPricingPort, { decisions: failure } as CatalogQualificationPort).execute(
      { query: {} } as never,
      readHandlerContext('catalog.listings.read', {} as never)
    );
    expect(reply.body.items[0]).toMatchObject({
      pool_id: null,
      price_amount_minor: null,
      price_version: null,
      saleable_stock: null,
      qualification_eligible: null,
      data_gaps: ['pool_missing', 'inventory_unavailable', 'pricing_unavailable', 'qualification_unavailable'],
    });
  });
});
