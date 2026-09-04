import { defineModuleManifest } from '@shop/kernel';
import { WEB_BUSINESS_OPERATION_IDS } from './WebBusinessOperationIds';

/** Web Business API-owned, deployment-lived composition. It is replaceable; canonical operation and data ownership is forbidden. */
export const webBusinessManifest = defineModuleManifest({
  id: 'webbusiness',
  version: '1.0.0',
  kind: 'composition',
  provides: [],
  requires: [
    'access.read',
    'benefit.read',
    'cart.manage',
    'catalog.read',
    'checkout.manage',
    'fulfillment.read',
    'inventory.read',
    'member.manage',
    'order.read',
    'organization.layers.read',
    'pricing.read',
    'reporting.read',
    'risk.read',
  ],
  operations: WEB_BUSINESS_OPERATION_IDS,
  publishes: [],
  consumes: [],
  publicEntry: './index.ts',
  layers: ['public', 'application', 'adapters', 'interface', 'tests'],
  entrypoints: {
    http: ['WEB_BUSINESS_MODULES', 'PublicCatalogHttpHandler'],
    jobs: [],
  },
});
