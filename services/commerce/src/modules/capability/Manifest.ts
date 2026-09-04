import { FEATURE_CAPABILITY_CODES } from '@shop/contract';
import { defineModuleManifest } from '../../bootstrap/ModuleManifest';
import { CAPABILITY_READINESS_PORT, CHANNEL_CAPABILITY_PORT, NAVIGATION_CAPABILITY_PORT } from './public';

export const PublishableCapabilities = FEATURE_CAPABILITY_CODES;

export const Manifest = defineModuleManifest({
  id: 'capability',
  dependencies: ['organization'],
  services: ['database.pool', 'audit.sink'],
  ports: [CHANNEL_CAPABILITY_PORT, NAVIGATION_CAPABILITY_PORT, CAPABILITY_READINESS_PORT],
  capabilities: PublishableCapabilities,
});
