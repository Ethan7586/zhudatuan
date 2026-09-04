import { defineModuleManifest } from '../../bootstrap/ModuleManifest';
import { RUNTIME_CHECKOUT_PORT } from './public';

export const Manifest = defineModuleManifest({
  id: 'checkout',
  dependencies: ['access', 'benefit', 'cart', 'catalog', 'experience', 'finance', 'inventory', 'marketing', 'member', 'order', 'organization', 'payment', 'pricing', 'qualification', 'risk', 'voucher'],
  services: ['database.pool', 'security.keys'],
  workloads: { jobs: { dependencies: ['payment', 'inventory', 'order'], services: ['database.pool'], ports: [RUNTIME_CHECKOUT_PORT] } },
});
