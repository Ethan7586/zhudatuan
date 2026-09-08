import { defineModuleManifest } from '../../composition/ModuleManifest';
import { REFERRAL_READ_PORT, REFERRAL_WRITE_PORT } from './public';

export const Manifest = defineModuleManifest({
  id: 'referral',
  dependencies: ['member', 'catalog', 'approval'],
  services: ['database.pool', 'security.keys'],
  ports: [REFERRAL_READ_PORT, REFERRAL_WRITE_PORT],
  workloads: { jobs: { dependencies: ['finance', 'approval'], services: ['database.pool'] } },
});
