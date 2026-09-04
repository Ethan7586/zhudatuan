import { defineModuleManifest } from '@shop/kernel';
import { CATALOG_CAPABILITIES } from './01_public_gongkai/CatalogCapabilities';

export const catalogManifest = defineModuleManifest({
  id: 'catalog',
  version: '1.0.0',
  kind: 'business',
  provides: [CATALOG_CAPABILITIES.read, CATALOG_CAPABILITIES.manage],
  requires: ['partner'],
  operations: [
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
  ],
  publishes: ['catalog.listing.published', 'catalog.listing.unpublished'],
  consumes: [],
  publicEntry: './index.ts',
  layers: ['public', 'application', 'adapters', 'interface', 'tests'],
  entrypoints: {
    http: ['catalogOperations', 'catalogOperatorReadOperations'],
    jobs: ['catalogimport'],
  },
});
