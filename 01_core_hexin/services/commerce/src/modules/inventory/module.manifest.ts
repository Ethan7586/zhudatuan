import { defineModuleManifest } from '@shop/kernel';
import { INVENTORY_CAPABILITIES } from './01_public_gongkai/InventoryCapabilities';

export const inventoryManifest = defineModuleManifest({
  id: 'inventory',
  version: '1.0.0',
  kind: 'business',
  provides: [INVENTORY_CAPABILITIES.read, INVENTORY_CAPABILITIES.manage],
  requires: ['catalog'],
  operations: [
    'inventory.availability.read',
    'inventory.imports.create',
    'inventory.imports.read',
  ],
  publishes: [],
  consumes: [],
  publicEntry: './index.ts',
  layers: ['public', 'domain', 'application', 'adapters', 'interface', 'tests'],
  entrypoints: {
    http: ['inventoryOperations'],
    jobs: ['inventoryimport', 'inventorysync'],
  },
});
