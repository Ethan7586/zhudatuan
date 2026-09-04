import { describe, expect, it } from 'vitest';
import { isStrictTaxonomyPath } from './taxonomy';

describe('strict taxonomy paths', () => {
  it('accepts a complete parent-child path', () => {
    expect(isStrictTaxonomyPath('appliance', 'appliance_living', 'appliance_living_clean')).toBe(true);
  });

  it('rejects a leaf attached to the wrong parent', () => {
    expect(isStrictTaxonomyPath('appliance', 'appliance_kitchen', 'appliance_living_clean')).toBe(false);
  });

  it('rejects incomplete or review-only paths', () => {
    expect(isStrictTaxonomyPath('appliance', null, 'appliance_living_clean')).toBe(false);
  });
});
