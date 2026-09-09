import { describe, expect, it } from 'vitest';
import { Listing } from './Listing';
import { Pool } from './Pool';
import { Product } from './Product';
import { Sku } from './Sku';
import { ListingEligibility } from '../policy/ListingEligibility';
import { Category } from './Category';

describe('Catalog aggregates', () => {
  it('keeps aggregate versions and terminal product archive rules in the domain', () => {
    const product = Product.create({ id: 'product:one', scope: 'mall:one', owner: null, brand: null, category: 'category:food', title: ' 早餐 ', kind: 'physical', attributes: {} });
    expect(product.snapshot()).toMatchObject({ title: '早餐', state: 'draft', version: 1 });
    const archived = product.archive(1);
    expect(archived.snapshot()).toMatchObject({ state: 'archived', version: 2 });
    expect(() => archived.change({ title: '午餐' }, 2)).toThrow();
  });

  it('models SKU uniqueness inputs and pool many-to-many membership without duplicates', () => {
    expect(Sku.create({ id: 'sku:one', product: 'product:one', code: 'meal-1', specifications: {} }).snapshot().code).toBe('MEAL-1');
    const pool = Pool.allocate({ id: 'pool:one', scope: 'mall:one', kind: 'private', name: '员工池', skus: ['sku:one'] });
    expect(pool.include(['sku:one', 'sku:two'], 1).snapshot().skus).toEqual(['sku:one', 'sku:two']);
  });

  it('keeps category hierarchy and active-use rules inside the category aggregate', () => {
    const category = Category.restore({ id: 'category:meal', parent: 'category:food', code: 'MEAL', name: '餐食', state: 'active', sort: 10 });
    expect(category.active()).toMatchObject({ id: 'category:meal', parent: 'category:food' });
    expect(() => Category.restore({ ...category.snapshot(), state: 'disabled' }).active()).toThrow();
  });

  it('creates a trimmed active category while keeping identity generation outside the aggregate', () => {
    const category = Category.create({ id: 'category:meal', parent: null, code: 'MEAL', name: ' 餐食 ', sort: 10 });
    expect(category.snapshot()).toEqual({ id: 'category:meal', parent: null, code: 'MEAL', name: '餐食', state: 'active', sort: 10 });
  });

  it('refuses publication when any centrally evaluated dependency has a gap', () => {
    const listing = Listing.draft({ id: 'listing:one', scope: 'mall:one', pool: 'pool:one', sku: 'sku:one', title: '早餐' });
    const decision = new ListingEligibility().decide({
      productState: 'active',
      skuState: 'active',
      poolReady: true,
      scopeReady: true,
      qualification: { eligible: true, version: 3 },
      price: { eligible: false, version: null },
      inventory: { eligible: true, version: 5 },
      channelReady: true,
    });
    expect(decision.gaps).toEqual(['PRICE_MISSING']);
    expect(() => listing.publish(1, decision, '2026-09-05T00:00:00.000Z')).toThrow();
  });
});
