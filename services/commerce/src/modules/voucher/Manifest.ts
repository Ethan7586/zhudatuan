import { defineModuleManifest } from '../../bootstrap/ModuleRegistry';
export const Manifest = defineModuleManifest('voucher', ['access', 'finance', 'organization'], ['database.pool', 'object.store'], {
  jobs: { dependencies: ['finance'], bindings: ['finance'], services: ['database.pool', 'object.store', 'kms.client'] },
});
