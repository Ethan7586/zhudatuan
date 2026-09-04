import { describe, expect, it } from 'vitest';
import { PRICING_CAPABILITIES, pricingManifest } from '..';

describe('pricing module manifest', () => {
  it('keeps stable pricing identity and public entry', () => {
    expect(pricingManifest.id).toBe('pricing');
    expect(pricingManifest.provides).toEqual([PRICING_CAPABILITIES.read, PRICING_CAPABILITIES.manage]);
    expect(pricingManifest.publicEntry).toBe('./index.ts');
  });

  it('declares pricing operations and module entrypoints', () => {
    expect(pricingManifest.operations).toEqual([
      'pricing.offers.read',
      'pricing.rules.create',
      'pricing.rules.publish',
    ]);
    expect(pricingManifest.entrypoints.http).toEqual(['pricingOperations']);
  });
});
