import { defineModuleManifest } from '../../composition/ModuleManifest';
import { APPROVAL_PORT, APPROVAL_READ_PORT } from './public';

export const Manifest = defineModuleManifest({
  id: 'approval',
  ports: [APPROVAL_PORT, APPROVAL_READ_PORT],
  workloads: { jobs: { services: ['database.pool'], ports: [APPROVAL_PORT, APPROVAL_READ_PORT] } },
});
