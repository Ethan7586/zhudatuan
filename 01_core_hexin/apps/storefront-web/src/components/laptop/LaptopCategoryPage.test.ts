import { describe, expect, it } from 'vitest';
import { DEFAULT_PRICE_RANGE, productPriceInRange } from './LaptopCategoryPage';

describe('LaptopCategoryPage price range', () => {
  it('does not silently exclude high-price published products by default', () => {
    expect(productPriceInRange(53.25, DEFAULT_PRICE_RANGE)).toBe(true);
    expect(productPriceInRange(8_888, DEFAULT_PRICE_RANGE)).toBe(true);
  });

  it('applies an upper price only after the operator enters one', () => {
    expect(productPriceInRange(5_001, [0, 5_000])).toBe(false);
    expect(productPriceInRange(5_000, [0, 5_000])).toBe(true);
  });
});
