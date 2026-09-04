import { describe, expect, it } from 'vitest';
import { CHECKOUT_CAPABILITIES } from '../01_public_gongkai/CheckoutCapabilities';
import { checkoutManifest } from '../module.manifest';

describe('checkout module manifest', () => {
  it('keeps the stable checkout identity and public entry', () => {
    expect(checkoutManifest.id).toBe('checkout');
    expect(checkoutManifest.publicEntry).toBe('./index.ts');
    expect(checkoutManifest.provides).toEqual(Object.values(CHECKOUT_CAPABILITIES));
  });

  it('declares the implemented operation and event', () => {
    expect(checkoutManifest.operations).toEqual(['checkout.quote.create']);
    expect(checkoutManifest.publishes).toEqual(['checkout.quote.created']);
  });
});
