import { defineModuleManifest } from '../../bootstrap/ModuleRegistry';
export const Manifest = defineModuleManifest('inventory', [], ['database.pool', 'audit.sink', 'object.store'], {
  jobs: { dependencies: ['catalog'], services: ['database.pool', 'object.store'] },
  provider: { dependencies: ['catalog', 'channel', 'fulfillment'], services: ['database.pool'] },
});
