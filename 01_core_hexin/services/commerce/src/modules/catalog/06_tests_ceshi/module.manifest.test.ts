import { describe, expect, it } from 'vitest';
import { CATALOG_CAPABILITIES, catalogManifest } from '..';

describe('catalog module manifest', () => {
  it('keeps the stable catalog identity and lightweight public entry', () => {
    expect(catalogManifest.id).toBe('catalog');
    expect(catalogManifest.publicEntry).toBe('./index.ts');
    expect(catalogManifest.provides).toEqual([CATALOG_CAPABILITIES.read, CATALOG_CAPABILITIES.manage]);
  });

  it('declares catalog dependencies, layers, and entrypoints', () => {
    expect(catalogManifest.requires).toEqual(['partner']);
    expect(catalogManifest.layers).toEqual(['public', 'application', 'adapters', 'interface', 'tests']);
    expect(catalogManifest.entrypoints.http).toEqual([
      'catalogOperations',
      'catalogOperatorReadOperations',
      'catalogOperatorOperations',
    ]);
    expect(catalogManifest.entrypoints.jobs).toEqual(['catalogimport']);
  });

  it('declares the catalog operation inventory', () => {
    expect(catalogManifest.operations).toEqual([
      'catalog.pools.read',
      'catalog.pools.attach',
      'catalog.pools.detach',
      'catalog.pools.allocate',
      'catalog.products.create',
      'catalog.products.update',
      'catalog.products.archive',
      'catalog.listings.read',
      'catalog.listings.publish',
      'catalog.listings.unpublish',
      'catalog.listings.batch',
      'catalog.imports.create',
      'catalog.imports.read',
    ]);
  });

  it('declares catalog event ownership', () => {
    expect(catalogManifest.publishes).toEqual([
      'catalog.listing.published',
      'catalog.listing.unpublished',
    ]);
    expect(catalogManifest.consumes).toEqual([]);
  });
});
