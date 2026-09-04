import { CAPABILITY_CODES_BY_OWNER } from '@shop/contract';
import { defineModuleManifest } from '../../bootstrap/ModuleManifest';
import { VERIFICATION_CHANNEL_PORT } from './public';

export const NotificationCapabilities = CAPABILITY_CODES_BY_OWNER.notification;

export const Manifest = defineModuleManifest({
  id: 'notification',
  dependencies: ['access', 'identity', 'organization'],
  services: ['kms.client'],
  ports: [VERIFICATION_CHANNEL_PORT],
  workloads: { jobs: { dependencies: ['identity', 'organization'], services: ['database.pool', 'kms.client', 'notification.deliveries'] } },
  capabilities: NotificationCapabilities,
});
