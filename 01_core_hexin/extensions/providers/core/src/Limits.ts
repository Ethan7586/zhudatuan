import type { ProviderLimit } from '@shop/contract';

export const STANDARD_PROVIDER_LIMITS: ProviderLimit = Object.freeze({
  connectionTimeoutMs: 1000,
  responseTimeoutMs: 5000,
  totalDeadlineMs: 15000,
  maxConcurrency: 8,
  requestsPerSecond: 20,
  maxAttempts: 3,
  failureThreshold: 5,
  recoveryMs: 30000,
});
