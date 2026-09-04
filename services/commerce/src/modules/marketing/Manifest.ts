import { defineModuleManifest } from '../../bootstrap/ModuleManifest';
import { MARKETING_READ_PORT, MARKETING_RESERVE_PORT } from './public';

export const Manifest = defineModuleManifest({
  id: 'marketing',
  ports: [MARKETING_READ_PORT, MARKETING_RESERVE_PORT],
  workloads: { jobs: { services: ['database.pool'], ports: [MARKETING_RESERVE_PORT] } },
});
