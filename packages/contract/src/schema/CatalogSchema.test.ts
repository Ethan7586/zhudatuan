import { describe, expect, it } from 'vitest';
import { CATALOG_OUTPUT_SCHEMAS, CATALOG_QUERY_SCHEMAS } from './CatalogSchema';

const summary = Object.freeze({
  id: 'listing:one',
  scope_id: 'mall:one',
  pool_id: 'pool:one',
  sku_id: 'sku:one',
  title: '早餐',
  status: 'published',
  effective_at: null,
  expires_at: null,
  version: 2,
  cursor_sort: '2026-09-07T00:00:00.000Z',
  code: 'MEAL-1',
  product_id: 'product:one',
  product_type: 'physical',
  cover_url: null,
  subtitle: null,
  category_id: 'category:food',
  category_name: '食品',
  source: 'self',
  source_partner_id: null,
  source_partner_name: null,
  pool_name: '员工福利池',
  sku_count: 1,
  sku_total: 2,
  mall_count: 1,
  mall_total: 3,
  price_amount_minor: 9800,
  price_currency: 'CNY',
  price_version: 3,
  saleable_stock: 9,
  qualification_eligible: true,
  data_gaps: [],
});

describe('CatalogListingsReadOutput', () => {
  it('requires the complete console product summary', () => {
    expect(CATALOG_OUTPUT_SCHEMAS.CatalogListingsReadOutput.parse({ items: [summary], count: 1 })).toMatchObject({ items: [{ category_name: '食品', price_amount_minor: 9800 }] });
    expect(() => CATALOG_OUTPUT_SCHEMAS.CatalogListingsReadOutput.parse({ items: [{ ...summary, data_gaps: undefined }], count: 1 })).toThrow();
  });

  it('keeps Facets independent and accepts every URL-backed listing filter', () => {
    expect(
      CATALOG_QUERY_SCHEMAS.CatalogListingsReadInput.parse({
        supplier: 'partner:one',
        mall: 'mall:one',
        status: 'published',
        category: 'category:food',
        q: '早餐',
        limit: 20,
      })
    ).toMatchObject({ supplier: 'partner:one', mall: 'mall:one', status: 'published' });
    expect(
      CATALOG_OUTPUT_SCHEMAS.CatalogFacetsReadOutput.parse({
        categories: [{ value: 'category:food', label: '食品', count: 2 }],
        suppliers: [],
        malls: [],
        statuses: [{ value: 'published', label: null, count: 1 }],
      })
    ).toMatchObject({ categories: [{ label: '食品' }], statuses: [{ count: 1 }] });
  });
});
