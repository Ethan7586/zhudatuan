import { defineModuleManifest } from '../../bootstrap/ModuleRegistry';
export const Manifest = defineModuleManifest('catalog', ['inventory', 'organization', 'partner', 'pricing'], ['database.pool', 'object.store'], {
  jobs: { services: ['database.pool', 'object.store'] },
  provider: { dependencies: ['channel'] },
});
