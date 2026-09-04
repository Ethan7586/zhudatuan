import { defineModuleManifest } from '@shop/kernel';
import { CHECKOUT_CAPABILITIES } from './01_public_gongkai/CheckoutCapabilities';

export const checkoutManifest = defineModuleManifest({
  id: 'checkout',
  version: '1.0.0',
  kind: 'business',
  provides: [CHECKOUT_CAPABILITIES.read, CHECKOUT_CAPABILITIES.manage],
  requires: [
    'benefit.manage',
    'cart.manage',
    'inventory.manage',
    'marketing.manage',
    'pricing.manage',
    'qualification.manage',
    'voucher.manage',
  ],
  operations: ['checkout.quote.create'],
  publishes: ['checkout.quote.created'],
  consumes: [],
  publicEntry: './index.ts',
  layers: ['public', 'domain', 'application', 'adapters', 'interface', 'tests'],
  entrypoints: {
    http: ['checkoutOperations'],
    jobs: [],
  },
});
