import { defineModuleManifest } from '../../composition/ModuleManifest';
import {
  CART_CATALOG_PORT,
  CATALOG_DIMENSION_PORT,
  CATALOG_READ_PORT,
  CHECKOUT_CATALOG_PORT,
  EXPERIENCE_CATALOG_PORT,
  INVENTORY_CATALOG_PORT,
  MEMBER_CATALOG_PORT,
  PROVIDER_CATALOG_PORT,
  REFERRAL_CATALOG_PORT,
  RISK_CATALOG_PORT,
} from './public';

export const Manifest = defineModuleManifest({
  id: 'catalog',
  dependencies: ['inventory', 'organization', 'partner', 'pricing', 'qualification', 'runtime'],
  services: ['database.pool', 'object.store'],
  ports: [REFERRAL_CATALOG_PORT, CART_CATALOG_PORT, CHECKOUT_CATALOG_PORT, EXPERIENCE_CATALOG_PORT, CATALOG_READ_PORT, CATALOG_DIMENSION_PORT, MEMBER_CATALOG_PORT],
  workloads: {
    jobs: { dependencies: ['access', 'audit', 'partner', 'qualification', 'runtime'], services: ['database.pool', 'object.store'], ports: [RISK_CATALOG_PORT, INVENTORY_CATALOG_PORT, EXPERIENCE_CATALOG_PORT] },
    provider: { dependencies: ['channel'], ports: [PROVIDER_CATALOG_PORT] },
  },
});
