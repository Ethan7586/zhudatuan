export const WECHAT_NOTIFICATION_POLICY = Object.freeze({
  maximumConcurrency: 8, maximumQueue: 32, failureThreshold: 5, recoveryMilliseconds: 30_000,
  requestsPerSecond: 20, totalDeadlineMilliseconds: 15_000, attempts: 1, retryMinimumMilliseconds: 50, retryMaximumMilliseconds: 1_000,
});

export const WechatManifest = Object.freeze({
  id: 'wechat', version: '1.0.0', contractVersion: 'notification.delivery.v1', capabilities: ['Delivery', 'Template', 'SubscriptionMessage'],
  configSchema: 'notification.wechat.subscribe.v1', secretRefs: ['credentialRef'], healthOperation: 'local',
  permissions: Object.freeze(['network:api.weixin.qq.com', 'secret:notification', 'member:subscription-consent']),
  authorization: Object.freeze({ required: true, source: 'wechat-subscribe-message', scope: 'template' }),
  rateLimits: Object.freeze({ requestsPerSecond: WECHAT_NOTIFICATION_POLICY.requestsPerSecond, maxConcurrency: WECHAT_NOTIFICATION_POLICY.maximumConcurrency, maxQueue: WECHAT_NOTIFICATION_POLICY.maximumQueue }),
  timeout: Object.freeze({ connectionMs: 1_000, responseMs: 5_000, totalMs: WECHAT_NOTIFICATION_POLICY.totalDeadlineMilliseconds }),
  retryPolicy: Object.freeze({ maxAttempts: 1, reason: 'subscribe-send-has-no-provider-idempotency-key' }),
  circuitPolicy: Object.freeze({ failureThreshold: WECHAT_NOTIFICATION_POLICY.failureThreshold, recoveryMs: WECHAT_NOTIFICATION_POLICY.recoveryMilliseconds }),
} as const);
