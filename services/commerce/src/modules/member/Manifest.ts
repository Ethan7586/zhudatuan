import { defineModuleManifest } from '../../bootstrap/ModuleRegistry';
export const Manifest = defineModuleManifest('member', ['access', 'catalog'], ['database.pool', 'audit.sink', 'kms.client', 'object.store'], {
  jobs: { dependencies: ['access', 'identity'], services: ['database.pool', 'object.store'] },
});
