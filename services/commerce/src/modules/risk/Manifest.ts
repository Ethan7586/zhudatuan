import { defineModuleManifest } from '../../composition/ModuleManifest';
import { RISK_DECISION_PORT } from './public';

export const Manifest = defineModuleManifest({
  id: 'risk',
  dependencies: ['member'],
  services: ['database.pool', 'audit.sink'],
  ports: [RISK_DECISION_PORT],
  workloads: { jobs: { dependencies: ['approval', 'catalog'], services: ['database.pool'] } },
});
