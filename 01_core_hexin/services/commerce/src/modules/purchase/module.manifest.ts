import { defineModuleManifest } from '@shop/kernel';
import { PURCHASE_OPERATION_IDS } from './PurchaseOperations';

/** Purchase API-owned, deployment-lived composition. It is replaceable; canonical operation and data ownership is forbidden. */
export const purchaseManifest = defineModuleManifest({
  id: 'purchase',
  version: '1.0.0',
  kind: 'composition',
  provides: [],
  requires: [
    'access.manage',
    'benefit.manage',
    'checkout.manage',
    'fulfillment.manage',
    'inventory.manage',
    'marketing.manage',
    'order.manage',
    'payment.manage',
    'pricing.manage',
    'risk.read',
  ],
  operations: PURCHASE_OPERATION_IDS,
  publishes: ['checkout.quote.created'],
  consumes: [],
  publicEntry: './index.ts',
  layers: ['public', 'domain', 'application', 'adapters', 'interface', 'tests'],
  entrypoints: {
    http: ['PURCHASE_MODULES'],
    jobs: [],
  },
});
