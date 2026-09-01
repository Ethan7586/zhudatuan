import { defineModuleManifest } from '../../bootstrap/ModuleRegistry';
export const Manifest = defineModuleManifest('experience', ['catalog', 'marketing', 'organization'], ['database.pool'], {
  jobs: { services: ['database.pool', 'object.store', 'cache'] },
});
