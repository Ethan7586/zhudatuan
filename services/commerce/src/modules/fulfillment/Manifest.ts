import { defineModuleManifest } from '../../composition/ModuleManifest';
import { FINANCE_FULFILLMENT_PORT, INVENTORY_RETURN_PORT } from './public';

export const Manifest = defineModuleManifest({
  id: 'fulfillment',
  dependencies: ['order', 'organization'],
  ports: [FINANCE_FULFILLMENT_PORT, INVENTORY_RETURN_PORT],
  workloads: {
    jobs: { dependencies: ['order'], bindings: ['order'], services: ['database.pool'], ports: [FINANCE_FULFILLMENT_PORT] },
    provider: { dependencies: ['channel', 'order', 'organization', 'voucher'], bindings: ['order', 'voucher'], services: ['database.pool', 'extension.registry', 'secret.store'], ports: [INVENTORY_RETURN_PORT] },
  },
});
