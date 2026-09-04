import { defineModuleManifest } from '@shop/kernel';
import { MARKETING_CAPABILITIES } from './01_public_gongkai/MarketingCapabilities';

export const marketingManifest = defineModuleManifest({
  id: 'marketing',
  version: '1.0.0',
  kind: 'business',
  provides: Object.values(MARKETING_CAPABILITIES),
  requires: ['catalog'],
  operations: ['marketing.campaigns.read'],
  publishes: [],
  consumes: [],
  publicEntry: './index.ts',
  layers: ['public', 'application', 'interface', 'tests'],
  entrypoints: {
    http: ['marketingOperations'],
    jobs: [],
  },
});
