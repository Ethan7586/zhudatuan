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
      {
        id: 'supplier:cake', name: '甜觅蛋糕供应链', productCount: 3, skuCount: 3,
        trialProductCount: 0, publishedCount: 0, availableStock: 0, inventoryValueMinor: 0,
        minPriceMinor: null, maxPriceMinor: null, channel: '供应商直供', settlementMode: '按协议结算',
        agreementStatus: 'draft', capabilities: [],
      },
    ]);
  });

  it('keeps live price, inventory and agreement facts from the supplier read model', () => {
    const page = {
      items: [], count: 0, preview: {
        kind: 'console-product-v1', totalCount: 111, asOf: '2026-09-12T00:00:00Z',
        facets: { categories: [], malls: [], statuses: [], suppliers: [{
          value: 'partner:supplier:zhudatuan', label: '主打团供应商', count: 111,
          productCount: 111, skuCount: 111, trialProductCount: 10, publishedCount: 111,
          availableStock: 401800, inventoryValueMinor: 61178900,
          minPriceMinor: 100, maxPriceMinor: 680513, channel: '主打团自营货盘', settlementMode: '月结',
          agreementStatus: 'active', contractRef: 'ZDT-SUPPLY-DIRECT-2026',
          capabilities: ['catalog', 'pricing', 'inventory', 'settlement'],
          effectiveAt: '2026-09-11T16:00:00Z', lastSyncedAt: '2026-09-12T00:00:00Z',
        }] },
      },
    } as ListingPage;

    expect(supplyPartnersFromListingPage(page)[0]).toMatchObject({
      name: '主打团供应商', productCount: 111, trialProductCount: 10,
      availableStock: 401800, inventoryValueMinor: 61178900, agreementStatus: 'active',
    });
  });
});
