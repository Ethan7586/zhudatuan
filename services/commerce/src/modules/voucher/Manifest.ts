import { defineModuleManifest } from '../../bootstrap/ModuleManifest';
import { CHECKOUT_VOUCHER_PORT, FULFILLMENT_VOUCHER_PORT, PAYMENT_VOUCHER_PORT, VERIFICATION_VOUCHER_PORT } from './public';

export const Manifest = defineModuleManifest({
  id: 'voucher',
  dependencies: ['access', 'approval', 'finance', 'organization', 'partner', 'qualification', 'runtime'],
  services: ['database.pool', 'kms.client', 'object.store'],
  ports: [CHECKOUT_VOUCHER_PORT, VERIFICATION_VOUCHER_PORT, PAYMENT_VOUCHER_PORT],
  workloads: {
    jobs: { dependencies: ['access', 'finance', 'organization', 'runtime'], bindings: ['access', 'finance', 'organization', 'runtime'], services: ['database.pool', 'object.store', 'kms.client'], ports: [PAYMENT_VOUCHER_PORT] },
    provider: { ports: [FULFILLMENT_VOUCHER_PORT] },
  },
});
