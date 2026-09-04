import { defineModuleManifest } from '../../bootstrap/ModuleManifest';
import { CATALOG_INVENTORY_PORT, CHECKOUT_INVENTORY_PORT, INVENTORY_READ_PORT, ORDER_EXPIRY_INVENTORY_PORT, PAYMENT_INVENTORY_PORT, PROVIDER_INVENTORY_PORT } from './public';

export const Manifest = defineModuleManifest({
  id: 'inventory',
  dependencies: ['runtime'],
  services: ['database.pool', 'audit.sink', 'object.store'],
  ports: [CHECKOUT_INVENTORY_PORT, PAYMENT_INVENTORY_PORT, CATALOG_INVENTORY_PORT, INVENTORY_READ_PORT],
  workloads: {
    jobs: { dependencies: ['access', 'catalog', 'runtime'], services: ['database.pool', 'object.store'], ports: [PAYMENT_INVENTORY_PORT, ORDER_EXPIRY_INVENTORY_PORT] },
    provider: { dependencies: ['catalog', 'channel', 'fulfillment'], services: ['database.pool'], ports: [PROVIDER_INVENTORY_PORT] },
  },
});
