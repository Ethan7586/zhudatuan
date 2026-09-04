import { describe, expect, it } from 'vitest';
import { editableProductStatus } from '@shop/presentation';
import { canChangeListingPublication, productVersion } from './ProductAction';

describe('product publication policy', () => {
  it('allows publication only after the product is active', () => {
    expect(canChangeListingPublication('draft', 'review')).toBe(false);
    expect(canChangeListingPublication('draft', 'active')).toBe(true);
  });

  it('always permits taking an existing publication offline', () => {
    expect(canChangeListingPublication('published', 'archived')).toBe(true);
  });

  it('preserves the authoritative product status for editing', () => {
    expect(editableProductStatus('review')).toBe('review');
    expect(editableProductStatus(undefined)).toBe('draft');
  });

  it('accepts only safe authoritative versions for optimistic writes', () => {
    expect(productVersion('7')).toBe(7);
    expect(productVersion(-1)).toBeUndefined();
    expect(productVersion('not-a-version')).toBeUndefined();
  });
});
