import { describe, expect, it } from 'vitest';
import type { CartItem } from '../types';
import { cartCacheScope, readCartCache, writeCartCache } from './cartCache';

class MemoryStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

describe('cart cache', () => {
  it('keeps each member and mall isolated and restores valid cached rows', () => {
    const storage = new MemoryStorage();
    const scope = cartCacheScope('member:one', 'mall:one');
    const items = [{
      id: 'listing:one', productId: 'listing:one', quantity: 2, selected: true, selectedSpec: {},
      product: { id: 'listing:one', title: '福利商品' },
    }] as CartItem[];
    writeCartCache(scope, items, storage);

    expect(readCartCache(scope, storage)).toEqual(items);
    expect(readCartCache(cartCacheScope('member:two', 'mall:one'), storage)).toEqual([]);
  });

  it('ignores malformed cache data without blocking the cart page', () => {
    const storage = new MemoryStorage();
    storage.setItem('storefront:cart:broken', '{');
    expect(readCartCache('broken', storage)).toEqual([]);
  });
});
