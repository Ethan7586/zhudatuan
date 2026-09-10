import { describe, expect, it } from 'vitest';
import { listingFixture, sourceListingFixture } from '../test/ProductFixture';
import { productJourney } from './ProductJourney';

describe('productJourney', () => {
  it('offers one next action at a time from product data through publication', () => {
    expect(productJourney(listingFixture({ status: 'draft', pool_id: null, pool_name: null, mall_count: 0, price_amount_minor: null, saleable_stock: null, qualification_eligible: null })).next.action).toBe('pool');
    expect(productJourney(listingFixture({ status: 'draft', pool_id: 'pool:one', pool_name: '员工福利池', mall_count: 0, price_amount_minor: null, saleable_stock: null, qualification_eligible: null })).next.action).toBe('deliver');
    expect(productJourney(listingFixture({ status: 'draft', pool_id: 'pool:one', pool_name: '员工福利池', mall_count: 1, price_amount_minor: null, saleable_stock: null, qualification_eligible: null })).next.action).toBe('price');
    expect(productJourney(listingFixture({ status: 'draft', pool_id: 'pool:one', mall_count: 1, price_amount_minor: 9900, saleable_stock: 0, qualification_eligible: true })).next.action).toBe('inventory');
    expect(productJourney(listingFixture({ status: 'draft', pool_id: 'pool:one', mall_count: 1, price_amount_minor: 9900, saleable_stock: 12, qualification_eligible: false })).next.action).toBe('qualification');
    expect(productJourney(listingFixture({ status: 'draft', pool_id: 'pool:one', mall_count: 1, price_amount_minor: 9900, saleable_stock: 12, qualification_eligible: true })).next.action).toBe('publish');
    expect(productJourney(listingFixture({ pool_id: 'pool:one', pool_name: '员工福利池' })).next.action).toBe('detail');
  });

  it('marks only the first unfinished stage as current and keeps later stages pending', () => {
    const journey = productJourney(listingFixture({ status: 'draft', pool_id: 'pool:one', pool_name: '员工福利池', mall_count: 0, price_amount_minor: null, saleable_stock: null, qualification_eligible: null }));
    expect(journey.steps.map(({ state }) => state)).toEqual(['complete', 'complete', 'current', 'pending', 'pending']);
    expect(journey.steps[2]?.detail).toContain('选择目标商城');
  });

  it('blocks a supplier source row until a real product mapping exists', () => {
    const journey = productJourney(sourceListingFixture());
    expect(journey.steps[0]?.state).toBe('blocked');
    expect(journey.next).toMatchObject({ action: 'detail', label: '查看商品映射' });
  });
});
