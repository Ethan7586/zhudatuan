import { defineModuleManifest } from '../../bootstrap/ModuleRegistry';
export const Manifest = defineModuleManifest('support', ['access', 'order', 'benefit', 'organization'], ['kms.client', 'object.store'], {
  jobs: { services: ['database.pool', 'object.store'] },
});
