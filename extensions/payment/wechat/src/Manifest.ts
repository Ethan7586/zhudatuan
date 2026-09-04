import { RUNTIME_LIMITS } from '@shop/config/runtime';

export const WechatPaymentExecutionPolicy = Object.freeze({
  maximumConcurrency: RUNTIME_LIMITS.external.maximumConcurrency,
  maximumQueue: RUNTIME_LIMITS.external.maximumQueue,
  failureThreshold: RUNTIME_LIMITS.external.failureThreshold,
  recoveryMilliseconds: RUNTIME_LIMITS.external.recoveryMilliseconds,
  requestsPerSecond: RUNTIME_LIMITS.external.requestsPerSecond,
  totalDeadlineMilliseconds: RUNTIME_LIMITS.external.totalDeadlineMilliseconds,
  attempts: RUNTIME_LIMITS.external.attempts,
  retryMinimumMilliseconds: RUNTIME_LIMITS.external.retryMinimumMilliseconds,
  retryMaximumMilliseconds: RUNTIME_LIMITS.external.retryMaximumMilliseconds,
});

export const WechatPaymentManifest = Object.freeze({
  id: 'wechat',
  version: '1.0.0',
  contractVersion: 'payment.gateway.v1',
  scenes: Object.freeze(['miniapp', 'jsapi'] as const),
  capabilities: Object.freeze(['prepay', 'query', 'close', 'refund', 'webhook'] as const),
  operations: Object.freeze(['Create', 'Query', 'Close', 'Refund', 'Webhook'] as const),
  configSchema: 'payment.wechat.apiv3.v1',
  secretRefs: Object.freeze(['WECHAT_APPLICATION_CONFIG_REF', 'WECHAT_PAYMENT_CONFIG_REF'] as const),
  permissions: Object.freeze(['network:api.mch.weixin.qq.com', 'secret:providerconfig'] as const),
  rateLimits: Object.freeze({
    requestsPerSecond: WechatPaymentExecutionPolicy.requestsPerSecond,
    maxConcurrency: WechatPaymentExecutionPolicy.maximumConcurrency,
    maxQueue: WechatPaymentExecutionPolicy.maximumQueue,
  }),
  timeout: Object.freeze({
    connectionMs: RUNTIME_LIMITS.external.connectionTimeoutMilliseconds,
    responseMs: RUNTIME_LIMITS.external.responseTimeoutMilliseconds,
    totalMs: WechatPaymentExecutionPolicy.totalDeadlineMilliseconds,
  }),
  retryPolicy: Object.freeze({
    maxAttempts: WechatPaymentExecutionPolicy.attempts,
    minimumDelayMs: WechatPaymentExecutionPolicy.retryMinimumMilliseconds,
    maximumDelayMs: WechatPaymentExecutionPolicy.retryMaximumMilliseconds,
  }),
  circuitPolicy: Object.freeze({
    failureThreshold: WechatPaymentExecutionPolicy.failureThreshold,
    recoveryMs: WechatPaymentExecutionPolicy.recoveryMilliseconds,
  }),
  healthOperation: 'configuration',
  webhook: Object.freeze({ path: '/api/v1/webhooks/wechat/payment', signature: 'RSA-SHA256', replayWindowSeconds: 300 }),
} as const);
