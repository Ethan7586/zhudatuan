import { defineModuleManifest } from '../../bootstrap/ModuleRegistry';
export const Manifest = defineModuleManifest('channel', ['extension', 'organization', 'capability'], ['kms.client', 'extension.loader', 'extension.manifestverifier'], {
  jobs: { services: [] },
  provider: { services: ['database.pool', 'extension.registry', 'secret.store', 'kms.client'] },
});
