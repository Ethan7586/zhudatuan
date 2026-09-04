import { defineModuleManifest } from '@shop/kernel';
import { CART_CAPABILITIES } from './01_public_gongkai/CartCapabilities';

export const cartManifest = defineModuleManifest({
  id: 'cart',
  version: '1.0.0',
  kind: 'business',
  provides: [CART_CAPABILITIES.read, CART_CAPABILITIES.manage],
  requires: ['catalog'],
  operations: ['cart.current.read', 'cart.items.put', 'cart.items.batch'],
  publishes: [],
  consumes: [],
  publicEntry: './index.ts',
  layers: ['public', 'application', 'interface', 'tests'],
  entrypoints: {
    http: ['cartOperations'],
    jobs: [],
  },
});
