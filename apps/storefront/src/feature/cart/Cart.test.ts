import { describe, expect, it } from 'vitest';
import { projectCart } from './viewmodel/CartProjection';

describe('cart mapping', () => {
  it('keeps listing and line versions without selecting rows implicitly', () => {
    const product = { id: 'listing:1', skuId: 'sku:1' } as never;
    const cart = projectCart({ version: 7, items: [{ listing: 'listing:1', sku: 'sku:1', quantity: 2, version: 4 }] }, [product], new Set());
    expect(cart).toMatchObject({ version: 7, lines: [{ listingId: 'listing:1', lineVersion: 4, selected: false }] });
  });
});
