import { defineModuleManifest } from '../../bootstrap/ModuleRegistry';
export const Manifest = defineModuleManifest('extension', ['organization'], ['database.pool', 'audit.sink'], {
  provider: { dependencies: ['channel'], services: ['database.pool', 'extension.loader', 'telemetry'] },
});
