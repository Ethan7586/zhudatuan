import { defineModuleManifest } from '../../bootstrap/ModuleRegistry';
export const Manifest = defineModuleManifest('support', ['access', 'order', 'benefit', 'organization', 'member'], ['event.stream', 'kms.client', 'object.store', 'secret.store'], {
  jobs: { dependencies: ['runtime'], bindings: ['runtime'], services: ['database.pool', 'object.store', 'event.stream'] },
});
