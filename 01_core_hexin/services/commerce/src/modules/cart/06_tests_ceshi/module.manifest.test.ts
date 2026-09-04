import { describe, expect, it } from 'vitest';
import { CART_CAPABILITIES, cartManifest } from '..';

describe('cart module manifest', () => {
  it('keeps stable module identity and public entry', () => {
    expect(cartManifest.id).toBe('cart');
    expect(cartManifest.provides).toEqual([CART_CAPABILITIES.read, CART_CAPABILITIES.manage]);
    expect(cartManifest.publicEntry).toBe('./index.ts');
  });

  it('declares complete cart operations and module entrypoints', () => {
    expect(cartManifest.operations).toEqual([
      'cart.current.read',
      'cart.items.put',
      'cart.items.batch',
    ]);
    expect(cartManifest.entrypoints.http).toEqual(['cartOperations']);
  });
});
