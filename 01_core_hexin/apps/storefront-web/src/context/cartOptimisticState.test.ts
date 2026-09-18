import { describe, expect, it } from 'vitest';
import type { CartItem, Product } from '../types';
import { addCartItemOptimistically, rollbackCartQuantity, setCartQuantityOptimistically } from './cartOptimisticState';
import { mergeAuthoritativeCart } from './cartServerState';

const product = (id = 'listing:one'): Product => ({
  id,
  skuId: `sku:${id}`,
  title: '福利商品',
  subtitle: '企业严选',
  images: ['/product.jpg'],
  priceMarket: 100,
  priceMall: 80,
  priceWelfare: 80,
  categoryId: 'category:one',
  categoryName: '福利品',
  brand: '福福网',
  tags: [],
  supplierId: 'supplier:one',
  supplierName: '供应商',
  supplierType: 'third_party',
  itemType: 'physical',
  allowedAccounts: ['welfare'],
  stock: 20,
  salesCount: 0,
  rating: 5,
  reviewCount: 0,
  deliverySla: '次日达',
});

const cartItem = (quantity = 1): CartItem => ({
  id: 'listing:one',
  productId: 'listing:one',
  product: product(),
  quantity,
  selectedSpec: {},
  selected: true,
});

describe('optimistic cart state', () => {
  it('adds five rapid increments to one line instead of creating duplicates', () => {
    let items: CartItem[] = [];
    for (let index = 0; index < 5; index += 1) items = addCartItemOptimistically(items, product(), 1, {}).items;
    expect(items).toHaveLength(1);
    expect(items[0]?.quantity).toBe(5);
  });

  it('updates totals locally and can restore a removed item after a failed write', () => {
    const before = cartItem(2);
    const removed = setCartQuantityOptimistically([before], before.id, 0);
    expect(removed?.items).toEqual([]);
    expect(rollbackCartQuantity([], before, before.id, 2)).toEqual([before]);
  });

  it('uses cached product presentation when the authoritative cart arrives before catalog data', () => {
    const fallback = cartItem(1);
    const merged = mergeAuthoritativeCart([{
      id: fallback.id,
      productId: fallback.productId,
      skuId: fallback.product.skuId!,
      quantity: 4,
      selected: true,
      updatedAt: '2026-09-09T00:00:00.000Z',
    }], [], [fallback]);
    expect(merged[0]?.quantity).toBe(4);
    expect(merged[0]?.product.title).toBe('福利商品');
  });
});
