import type { ProviderLimit, ProviderManifest } from '@shop/contract';

export const STANDARD_PROVIDER_POLICY = Object.freeze({
  rateLimits: Object.freeze({ requestsPerSecond: 20, maxConcurrency: 8 }),
  timeout: Object.freeze({ connectionMs: 1_000, responseMs: 5_000, totalMs: 15_000 }),
  retryPolicy: Object.freeze({ maxAttempts: 3 }),
  circuitPolicy: Object.freeze({ failureThreshold: 5, recoveryMs: 30_000 }),
});

export const STANDARD_INTEGRATION_LIMIT: ProviderLimit = Object.freeze({
  connectionTimeoutMs: STANDARD_PROVIDER_POLICY.timeout.connectionMs,
  responseTimeoutMs: STANDARD_PROVIDER_POLICY.timeout.responseMs,
  totalDeadlineMs: STANDARD_PROVIDER_POLICY.timeout.totalMs,
  maxConcurrency: STANDARD_PROVIDER_POLICY.rateLimits.maxConcurrency,
  requestsPerSecond: STANDARD_PROVIDER_POLICY.rateLimits.requestsPerSecond,
  maxAttempts: STANDARD_PROVIDER_POLICY.retryPolicy.maxAttempts,
  failureThreshold: STANDARD_PROVIDER_POLICY.circuitPolicy.failureThreshold,
  recoveryMs: STANDARD_PROVIDER_POLICY.circuitPolicy.recoveryMs,
});

export function providerLimit(manifest: ProviderManifest): ProviderLimit {
  return Object.freeze({
    connectionTimeoutMs: manifest.timeout.connectionMs,
    responseTimeoutMs: manifest.timeout.responseMs,
    totalDeadlineMs: manifest.timeout.totalMs,
    maxConcurrency: manifest.rateLimits.maxConcurrency,
    requestsPerSecond: manifest.rateLimits.requestsPerSecond,
    maxAttempts: manifest.retryPolicy.maxAttempts,
    failureThreshold: manifest.circuitPolicy.failureThreshold,
    recoveryMs: manifest.circuitPolicy.recoveryMs,
  });
}
