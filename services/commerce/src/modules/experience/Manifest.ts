import { defineModuleManifest } from '../../composition/ModuleManifest';
import { CART_EXPERIENCE_PORT, CHECKOUT_EXPERIENCE_PORT, EXPERIENCE_DIMENSION_PORT, EXPERIENCE_READ_PORT, IDENTITY_EXPERIENCE_PORT } from './public';

export const Manifest = defineModuleManifest({
  id: 'experience',
  dependencies: ['catalog', 'inventory', 'marketing', 'organization', 'pricing', 'qualification', 'runtime'],
  services: ['database.pool', 'object.store', 'cache', 'telemetry', 'storefront.config'],
  ports: [CART_EXPERIENCE_PORT, CHECKOUT_EXPERIENCE_PORT, EXPERIENCE_DIMENSION_PORT, EXPERIENCE_READ_PORT, IDENTITY_EXPERIENCE_PORT],
  workloads: {
    jobs: {
      dependencies: ['catalog', 'organization'],
      bindings: ['catalog', 'organization'],
      services: ['database.pool', 'object.store', 'cache', 'telemetry'],
      ports: [EXPERIENCE_DIMENSION_PORT],
    },
  },
});
