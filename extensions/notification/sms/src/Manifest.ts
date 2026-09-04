export const SMS_POLICY = Object.freeze({
  rateLimits: Object.freeze({ requestsPerSecond: 20, maxConcurrency: 8, maxQueue: 32 }),
  timeout: Object.freeze({ connectionMs: 1_000, responseMs: 5_000, totalMs: 15_000 }),
  retryPolicy: Object.freeze({ maxAttempts: 3, minimumDelayMs: 50, maximumDelayMs: 1_000 }),
  circuitPolicy: Object.freeze({ failureThreshold: 5, recoveryMs: 30_000 }),
});

export const SmsManifest = Object.freeze({
  id: 'sms',
  version: '1.0.0',
  contractVersion: 'notification.delivery.v1',
  capabilities: ['Delivery', 'TemplateMapping', 'OptOut', 'Receipt'],
  configSchema: 'notification.sms.aliyun.v1',
  secretRefs: ['credentialRef'],
  permissions: ['network:dysmsapi.aliyuncs.com', 'network:ecsmetadata', 'secret:notification'],
  healthOperation: 'client',
  ...SMS_POLICY,
} as const);
