import { defineModuleManifest } from '../../composition/ModuleManifest';
import { FINANCE_ORDER_PORT, ORDER_EXPIRY_PORT, ORDER_FULFILLMENT_PORT, ORDER_INTENT_PORT, ORDER_PAYMENT_JOB_PORT, ORDER_PAYMENT_PORT, ORDER_READ_PORT, ORDER_RECEIPT_PORT, SUPPORT_ORDER_PORT } from './public';

export const Manifest = defineModuleManifest({
  id: 'order',
  dependencies: ['organization', 'qualification', 'audit', 'member', 'runtime'],
  services: ['database.pool', 'audit.sink', 'object.store'],
  ports: [ORDER_INTENT_PORT, ORDER_PAYMENT_PORT, ORDER_FULFILLMENT_PORT, SUPPORT_ORDER_PORT, ORDER_RECEIPT_PORT, ORDER_READ_PORT, FINANCE_ORDER_PORT],
  workloads: {
    jobs: { dependencies: ['access', 'runtime', 'organization', 'member', 'payment', 'finance'], services: ['database.pool', 'object.store'], ports: [ORDER_EXPIRY_PORT, ORDER_PAYMENT_JOB_PORT, ORDER_FULFILLMENT_PORT, FINANCE_ORDER_PORT] },
    provider: { ports: [ORDER_FULFILLMENT_PORT] },
  },
});
