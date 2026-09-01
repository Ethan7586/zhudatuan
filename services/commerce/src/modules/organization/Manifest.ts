import { defineModuleManifest } from '../../bootstrap/ModuleRegistry';
export const Manifest = defineModuleManifest('organization', [], ['database.pool', 'audit.sink', 'secret.store', 'kms.client'], {
  jobs: { dependencies: ['access'], services: ['database.pool', 'secret.store', 'kms.client', 'identity.securitykeys'] },
});
