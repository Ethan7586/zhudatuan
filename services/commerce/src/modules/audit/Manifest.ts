import { defineModuleManifest } from '../../bootstrap/ModuleRegistry';
export const Manifest = defineModuleManifest('audit', [], ['database.pool', 'audit.sink', 'audit.port'], {
  jobs: { services: ['database.pool', 'object.store', 'kms.client'] },
});
