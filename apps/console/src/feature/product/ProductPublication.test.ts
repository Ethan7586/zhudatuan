import { describe, expect, it } from 'vitest';
import { canChangeListingPublication, productStatus } from './ProductPublication';

describe('product publication policy', () => {
  it('allows publication only after the product is active', () => {
    expect(canChangeListingPublication('draft', 'review')).toBe(false);
    expect(canChangeListingPublication('draft', 'active')).toBe(true);
  });

  it('always permits taking an existing publication offline', () => {
    expect(canChangeListingPublication('published', 'archived')).toBe(true);
  });

  it('preserves the authoritative product status for editing', () => {
    expect(productStatus('review')).toBe('review');
    expect(productStatus('unknown')).toBe('draft');
  });
});
