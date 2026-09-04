import type { Listing } from '../model/Product';
import type { ManagedListing } from '../model/ProductAction';

type SourceListing = Exclude<Listing, ManagedListing>;

const base: ManagedListing = Object.freeze({
  id: 'listing:one',
  scope_id: 'mall:one',
  pool_id: null,
  sku_id: 'sku:one',
  product_id: 'product:one',
  title: '办公福利礼盒',
  status: 'published',
  version: 3,
  effective_at: null,
  expires_at: null,
  cursor_sort: '2026-09-07T08:00:00.000Z',
  code: 'SKU-1',
  product_type: 'physical',
  cover_url: null,
  subtitle: null,
  category_id: 'category:office',
  category_name: '办公用品',
  source: 'self',
  source_partner_id: null,
  pool_name: null,
  sku_count: 1,
  sku_total: 1,
  mall_count: 1,
  mall_total: 1,
  price_amount_minor: 9900,
  price_currency: 'CNY',
  saleable_stock: 12,
  qualification_eligible: true,
  data_gaps: Object.freeze([]),
});

export function listingFixture(overrides: Partial<ManagedListing> = {}): ManagedListing {
  return Object.freeze({ ...base, ...overrides });
}

const source: SourceListing = Object.freeze({
  id: 'source:one',
  scope_id: 'mall:one',
  sku_id: null,
  product_id: null,
  title: '渠道福利礼盒',
  status: 'pending',
  version: 'source:v4',
  cursor_sort: '2026-09-07T08:00:00.000Z',
  code: null,
  product_type: null,
  cover_url: null,
  subtitle: null,
  category_id: null,
  category_name: null,
  source: 'supplier',
  source_partner_id: 'partner:one',
  pool_name: null,
  sku_count: 0,
  sku_total: 0,
  mall_count: 0,
  mall_total: 0,
  price_amount_minor: null,
  price_currency: null,
  saleable_stock: null,
  qualification_eligible: null,
  data_gaps: Object.freeze(['pool_missing', 'price_missing', 'inventory_missing']),
});

export function sourceListingFixture(overrides: Partial<SourceListing> = {}): SourceListing {
  return Object.freeze({ ...source, ...overrides });
}
