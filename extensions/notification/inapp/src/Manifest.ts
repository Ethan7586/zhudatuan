export const InappManifest = Object.freeze({
  id: 'inapp',
  version: '1.0.0',
  contractVersion: 'notification.delivery.v1',
  capabilities: ['Delivery', 'BatchDelivery', 'Acknowledgement', 'DeepLink'],
  configSchema: 'notification.inapp.v1',
  secretRefs: [],
  healthOperation: 'local',
  limits: Object.freeze({ maxBatchSize: 1_000 }),
} as const);
