import { describe, expect, it } from 'vitest';
import { UNRESOLVED_MALL } from './productionStorefrontState';

describe('production storefront state', () => {
  it('uses the L1 storefront name before member login resolves', () => {
    expect(UNRESOLVED_MALL.mallName).toBe('宏泰甄选');
  });
});
