import { describe, expect, it } from 'vitest';
import type { Product } from '../types';
import { cartSessionDecision, queueCartAddition } from './cartSessionRecovery';

const product: Product = {
  id: 'listing:one',
  skuId: 'sku:one',
  title: '福利商品',
  subtitle: '企业严选',
  images: ['/product.jpg'],
  priceMarket: 100,
  priceMall: 80,
  priceWelfare: 80,
  categoryId: 'category:one',
  categoryName: '福利品',
  brand: '宏泰甄选',
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
};

describe('cart interaction during session recovery', () => {
  it('distinguishes checking from a confirmed guest session', () => {
    expect(cartSessionDecision('checking', false)).toBe('queue');
    expect(cartSessionDecision('guest', false)).toBe('require-login');
    expect(cartSessionDecision('authenticated', false)).toBe('commit');
    expect(cartSessionDecision('guest', true)).toBe('commit');
  });

  it('coalesces repeated taps into one immutable pending addition', () => {
    const selectedSpec = { color: '蓝色' };
    const first = queueCartAddition(null, product, 1, selectedSpec);
    selectedSpec.color = '红色';
    const repeated = queueCartAddition(first, product, 1, { color: '蓝色' });

    expect(repeated).toBe(first);
    expect(first).toMatchObject({ productId: 'listing:one', quantity: 1, selectedSpec: { color: '蓝色' } });
  });

  it('keeps the latest distinct cart intent while identity is still resolving', () => {
    const first = queueCartAddition(null, product, 1, { color: '蓝色' });
    const latest = queueCartAddition(first, { ...product, id: 'listing:two' }, 2, { color: '红色' });

    expect(latest).not.toBe(first);
    expect(latest).toMatchObject({ productId: 'listing:two', quantity: 2, selectedSpec: { color: '红色' } });
  });
});
