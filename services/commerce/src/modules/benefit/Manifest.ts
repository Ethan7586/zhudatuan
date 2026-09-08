import { defineModuleManifest } from '../../composition/ModuleManifest';
import { BENEFIT_READ_PORT, CHECKOUT_BENEFIT_PORT, PAYMENT_BENEFIT_PORT, SUPPORT_BENEFIT_PORT } from './public';

export const Manifest = defineModuleManifest({
  id: 'benefit',
  dependencies: ['access', 'finance'],
  bindings: ['finance'],
  services: ['database.pool'],
  ports: [CHECKOUT_BENEFIT_PORT, PAYMENT_BENEFIT_PORT, BENEFIT_READ_PORT, SUPPORT_BENEFIT_PORT],
  workloads: { jobs: { dependencies: ['finance', 'member'], bindings: ['finance'], services: ['database.pool'], ports: [PAYMENT_BENEFIT_PORT] } },
});
