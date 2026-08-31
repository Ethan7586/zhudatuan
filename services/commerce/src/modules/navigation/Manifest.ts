import { defineModuleManifest } from '../../bootstrap/ModuleRegistry';

export const Manifest = defineModuleManifest(
  'navigation',
  ['identity', 'access', 'organization', 'capability', 'member', 'benefit', 'order', 'experience', 'catalog', 'pricing', 'inventory'],
  ['database.pool', 'audit.sink', 'cache', 'telemetry', 'navigation.securitykey', 'navigation.clock']
);
