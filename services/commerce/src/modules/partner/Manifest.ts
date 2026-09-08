import { defineModuleManifest } from '../../composition/ModuleManifest';
import { ACCESS_PARTNER_PORT, CATALOG_PARTNER_PORT, VOUCHER_CUSTOMER_PORT } from './public';

export const Manifest = defineModuleManifest({
  id: 'partner',
  dependencies: ['organization'],
  services: ['database.pool', 'audit.sink', 'kms.client'],
  ports: [ACCESS_PARTNER_PORT, CATALOG_PARTNER_PORT, VOUCHER_CUSTOMER_PORT],
  workloads: { jobs: { ports: [CATALOG_PARTNER_PORT] } },
});
