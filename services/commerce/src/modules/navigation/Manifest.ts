import { defineModuleManifest } from '../../bootstrap/ModuleManifest';
import { NAVIGATION_PORTS } from './public';

export const Manifest = defineModuleManifest({
  id: 'navigation',
  dependencies: ['identity', 'access', 'organization', 'capability', 'member', 'benefit', 'order', 'experience', 'catalog', 'pricing', 'inventory'],
  services: ['cache', 'telemetry', 'navigation.securitykey', 'navigation.clock'],
  ports: NAVIGATION_PORTS,
  workloads: { jobs: { services: ['database.pool', 'cache', 'telemetry', 'navigation.securitykey', 'navigation.clock'] } },
});
