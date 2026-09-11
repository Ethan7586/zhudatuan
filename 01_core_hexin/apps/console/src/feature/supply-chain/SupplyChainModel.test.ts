import { describe, expect, it } from 'vitest';
import type { ListingPage } from '../product/ProductSchema';
import { supplyPartnersFromListingPage } from './SupplyChainModel';

describe('supplyPartnersFromListingPage', () => {
  it('uses real supplier facets and never derives visible signed levels', () => {
    const page = {
      items: [], count: 0, preview: {
        kind: 'console-product-v1', totalCount: 3, asOf: '2026-09-11T10:00:00Z',
        facets: { categories: [], malls: [], statuses: [], suppliers: [
          { value: 'supplier:cake', label: '甜觅蛋糕供应链', count: 3 },
        ] },
      },
    } as ListingPage;

    expect(supplyPartnersFromListingPage(page)).toEqual([
      { id: 'supplier:cake', name: '甜觅蛋糕供应链', productCount: 3 },
    ]);
  });
});
