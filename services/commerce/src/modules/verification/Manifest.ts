import { defineModuleManifest } from '../../composition/ModuleManifest';
import { RUNTIME_VERIFICATION_PORT, VERIFICATION_PORT } from './public';

export const Manifest = defineModuleManifest({
  id: 'verification',
  dependencies: ['access', 'member', 'notification', 'organization', 'voucher'],
  ports: [VERIFICATION_PORT],
  workloads: { jobs: { ports: [RUNTIME_VERIFICATION_PORT] } },
});
