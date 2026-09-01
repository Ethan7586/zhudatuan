import { defineModuleManifest } from '../../bootstrap/ModuleRegistry';

export const Manifest = defineModuleManifest(
  'navigation',
  ['identity', 'access', 'organization', 'capability', 'member', 'benefit', 'order', 'experience', 'catalog', 'pricing', 'inventory'],
  ['cache', 'telemetry', 'navigation.securitykey', 'navigation.clock'],
  { jobs: { services: ['database.pool', 'cache', 'telemetry', 'navigation.securitykey', 'navigation.clock'] } }
);
