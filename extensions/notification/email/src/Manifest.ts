export const EMAIL_POLICY = Object.freeze({
  maximumConcurrency: 16,
  maximumQueue: 64,
  failureThreshold: 5,
  recoveryMilliseconds: 30_000,
  requestsPerSecond: 50,
  totalDeadlineMilliseconds: 15_000,
  attempts: 3,
  retryMinimumMilliseconds: 50,
  retryMaximumMilliseconds: 1_000,
});

export const EmailManifest = Object.freeze({
  id: 'email', version: '1.0.0', contractVersion: 'notification.delivery.v1', capabilities: ['Delivery'],
  configSchema: 'notification.email.http.v1', secretRefs: ['credentialRef'], healthOperation: 'local',
  permissions: Object.freeze(['network:configured-email-endpoint', 'secret:notification']),
  rateLimits: Object.freeze({ requestsPerSecond: EMAIL_POLICY.requestsPerSecond, maxConcurrency: EMAIL_POLICY.maximumConcurrency, maxQueue: EMAIL_POLICY.maximumQueue }),
  timeout: Object.freeze({ connectionMs: 1_000, responseMs: 5_000, totalMs: EMAIL_POLICY.totalDeadlineMilliseconds }),
  retryPolicy: Object.freeze({ maxAttempts: EMAIL_POLICY.attempts, minimumDelayMs: EMAIL_POLICY.retryMinimumMilliseconds, maximumDelayMs: EMAIL_POLICY.retryMaximumMilliseconds }),
  circuitPolicy: Object.freeze({ failureThreshold: EMAIL_POLICY.failureThreshold, recoveryMs: EMAIL_POLICY.recoveryMilliseconds }),
} as const);
