import { describe, expect, it } from 'vitest';
import { projectCart } from './viewmodel/CartProjection';

const valid = Object.freeze({ state: 'valid' as const, code: 'valid', message: '商品可购买' });
const invalid = Object.freeze({ state: 'invalid' as const, code: 'unpublished', message: '商品已下架，仍为您保留在购物车中' });

describe('cart mapping', () => {
  it('keeps server-owned selection, current amounts and line versions', () => {
    const product = { listingId: 'listing:1', productId: 'product:1', skuId: 'sku:1', title: '商品' } as never;
    const cart = projectCart({ version: 7, merge: 'none', mergeReason: null, items: [{ listing: 'listing:1', sku: 'sku:1', quantity: 2, selected: true, version: 4, title: '商品', amountMinor: 1200, currency: 'CNY', available: 8, benefitApplicable: true, validity: valid }] }, [product]);
    expect(cart).toMatchObject({ version: 7, lines: [{ listingId: 'listing:1', lineVersion: 4, selected: true, amountMinor: 1200, benefitApplicable: true }] });
  });

  it('retains an unpublished line with an understandable fallback instead of silently deleting it', () => {
    const cart = projectCart({ version: 2, merge: 'none', mergeReason: null, items: [{ listing: 'listing:old', sku: 'sku:old', quantity: 1, selected: false, version: 1, title: '已失效商品', amountMinor: null, currency: null, available: null, benefitApplicable: false, validity: invalid }] }, []);
    expect(cart.lines).toHaveLength(1);
    expect(cart.lines[0]).toMatchObject({ title: '已失效商品', selected: false, product: { saleability: { state: 'blocked' } }, validity: { code: 'unpublished' } });
  });
});
