import { defineModuleManifest } from '@shop/kernel';
import { PRICING_CAPABILITIES } from './01_public_gongkai/PricingCapabilities';

export const pricingManifest = defineModuleManifest({
  id: 'pricing',
  version: '1.0.0',
  kind: 'business',
  provides: [PRICING_CAPABILITIES.read, PRICING_CAPABILITIES.manage],
  requires: ['catalog'],
  operations: ['pricing.offers.read', 'pricing.rules.create', 'pricing.rules.publish'],
  publishes: [],
  consumes: [],
  publicEntry: './index.ts',
  layers: ['public', 'application', 'interface', 'tests'],
  entrypoints: {
    http: ['pricingOperations'],
    jobs: [],
  },
});
