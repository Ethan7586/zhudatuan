import { defineModuleManifest } from '@shop/kernel';
import { FULFILLMENT_CAPABILITIES } from './01_public_gongkai/FulfillmentCapabilities';

export const fulfillmentManifest = defineModuleManifest({
  id: 'fulfillment',
  version: '1.0.0',
  kind: 'business',
  provides: [FULFILLMENT_CAPABILITIES.read, FULFILLMENT_CAPABILITIES.manage],
  requires: ['order', 'partner'],
  operations: [
    'fulfillment.tracking.read',
    'fulfillment.shipments.create',
    'fulfillment.returns.receive',
    'fulfillment.returns.inspect',
  ],
  publishes: [],
  consumes: [],
  publicEntry: './index.ts',
  layers: ['public', 'application', 'interface', 'tests'],
  entrypoints: {
    http: ['fulfillmentOperations'],
    jobs: ['fulfillment', 'tracking'],
  },
});
