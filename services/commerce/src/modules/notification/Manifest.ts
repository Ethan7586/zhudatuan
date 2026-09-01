import { defineModuleManifest } from '../../bootstrap/ModuleRegistry';
export const Manifest = defineModuleManifest('notification', ['access', 'identity', 'organization'], ['kms.client'], {
  jobs: { dependencies: ['identity', 'organization'], services: ['database.pool', 'kms.client', 'notification.deliveries'] },
});
