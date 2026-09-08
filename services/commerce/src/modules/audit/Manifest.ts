import { defineModuleManifest } from '../../composition/ModuleManifest';
import { AUDIT_PORT, AUDIT_READ_PORT } from './public';

export const Manifest = defineModuleManifest({
  id: 'audit',
  services: ['database.pool', 'audit.sink', 'audit.port'],
  ports: [AUDIT_PORT, AUDIT_READ_PORT],
  workloads: { jobs: { dependencies: ['runtime'], bindings: ['runtime'], services: ['database.pool', 'object.store', 'kms.client'] } },
});
