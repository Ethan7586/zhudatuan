import { describe, expect, it } from 'vitest';
import { createFetchSurface } from './ClientFactory';
import { createFetchCatalog, createFetchCatalogListingsRead } from './operations/catalog';
import { createFetchIdentity } from './operations/identity';

describe('generated domain factories', () => {
  it('constructs one named domain without a generic execution escape hatch', () => {
    const catalog = createFetchCatalog('https://shop.example');

    expect(typeof catalog.listingsRead).toBe('function');
    expect(typeof catalog.productsUpdate).toBe('function');
    expect('call' in catalog).toBe(false);
    expect('execute' in catalog).toBe(false);
  });

  it('provides a tree-shakable named Operation factory', () => {
    const readListings = createFetchCatalogListingsRead('https://shop.example');
    const identity = createFetchIdentity('https://shop.example');

    expect(typeof readListings).toBe('function');
    expect(typeof identity.sessionRead).toBe('function');
  });

  it('constructs target-isolated browser clients without exposing another surface', () => {
    const store = createFetchSurface('store', 'https://shop.example');
    const supplier = createFetchSurface('supplier', 'https://shop.example');

    expect(typeof store.verification.challengesVerify).toBe('function');
    expect('finance' in store).toBe(false);
    expect(typeof supplier.finance.statementsRead).toBe('function');
    expect('approval' in supplier).toBe(false);
  });
});
