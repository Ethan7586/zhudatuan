import { FEATURE_CAPABILITY_CODES } from '@shop/contract';
import { defineModuleManifest } from '../../composition/ModuleManifest';
import { CHANNEL_CAPABILITY_PORT, NAVIGATION_CAPABILITY_PORT } from './public';

export const PublishableCapabilities = FEATURE_CAPABILITY_CODES;

export const Manifest = defineModuleManifest({
  id: 'capability',
  dependencies: ['organization'],
  services: ['database.pool', 'audit.sink'],
  ports: [CHANNEL_CAPABILITY_PORT, NAVIGATION_CAPABILITY_PORT],
  capabilities: PublishableCapabilities,
});
