import { defineModuleManifest } from '../../bootstrap/ModuleManifest';
import { EXTENSION_REGISTRY_PORT } from './public';

export const Manifest = defineModuleManifest({
  id: 'extension',
  dependencies: ['organization'],
  services: ['database.pool', 'audit.sink', 'extension.registry', 'extension.loader', 'extension.manifestverifier'],
  ports: [EXTENSION_REGISTRY_PORT],
  workloads: { provider: { dependencies: ['channel'], services: ['database.pool', 'extension.loader', 'telemetry'] } },
});
