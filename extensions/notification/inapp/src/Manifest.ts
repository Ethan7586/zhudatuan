export const InappManifest = Object.freeze({
  id: 'inapp',
  version: '1.0.0',
  contractVersion: 'notification.delivery.v1',
  capabilities: ['Delivery'],
  configSchema: 'notification.inapp.v1',
  secretRefs: [],
  healthOperation: 'local',
} as const);
