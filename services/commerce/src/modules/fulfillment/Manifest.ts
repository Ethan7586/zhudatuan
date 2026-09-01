import { defineModuleManifest } from '../../bootstrap/ModuleRegistry';
export const Manifest = defineModuleManifest('fulfillment', ['order', 'organization'], [], {
  provider: { dependencies: ['channel', 'order', 'organization'], bindings: ['order'], services: ['database.pool', 'extension.registry', 'secret.store'] },
});
