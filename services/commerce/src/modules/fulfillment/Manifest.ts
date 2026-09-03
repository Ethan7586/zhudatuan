import { defineModuleManifest } from '../../bootstrap/ModuleRegistry';
export const Manifest = defineModuleManifest('fulfillment', ['order', 'organization'], [], {
  jobs: { dependencies: ['order'], bindings: ['order'] },
  provider: { dependencies: ['channel', 'order', 'organization'], bindings: ['order'], services: ['database.pool', 'extension.registry', 'secret.store'] },
});
