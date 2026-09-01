import { defineModuleManifest } from '../../bootstrap/ModuleRegistry';
export const Manifest = defineModuleManifest('experience', ['catalog', 'marketing', 'organization'], ['database.pool', 'cache', 'telemetry', 'storefront.config'], {
  jobs: { services: ['database.pool', 'object.store', 'cache', 'telemetry'] },
});
