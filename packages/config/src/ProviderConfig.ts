export interface ProviderConnectionConfig {
  readonly id: string;
  readonly baseUrl: string;
  readonly secretRef: string;
  readonly endpoints: Readonly<Record<string, string>>;
  readonly healthOperation: string;
  readonly limits: Readonly<{
    connectionTimeoutMs: number;
    responseTimeoutMs: number;
    totalDeadlineMs: number;
    maxConcurrency: number;
    requestsPerSecond: number;
    maxAttempts: number;
    failureThreshold: number;
    recoveryMs: number;
  }>;
}

const ROOT_KEYS = Object.freeze(['id', 'baseUrl', 'secretRef', 'endpoints', 'healthOperation', 'limits']);
const LIMIT_KEYS = Object.freeze(['connectionTimeoutMs', 'responseTimeoutMs', 'totalDeadlineMs', 'maxConcurrency', 'requestsPerSecond', 'maxAttempts', 'failureThreshold', 'recoveryMs']);

export function providerConnectionConfig(value: unknown, expectedHealthOperation: string): ProviderConnectionConfig {
  const source = strictConfigObject(value, ROOT_KEYS, 'PROVIDER_CONFIG');
  const id = text(source.id, 'PROVIDER_CONFIG_ID_INVALID');
  const baseUrl = httpsUrl(source.baseUrl);
  const secretRef = text(source.secretRef, 'PROVIDER_CONFIG_SECRET_REF_INVALID');
  if (!/^secret\/[a-z0-9][a-z0-9/.-]*$/i.test(secretRef)) throw new Error('PROVIDER_CONFIG_SECRET_REF_INVALID');
  const endpointsSource = strictConfigObject(source.endpoints, Object.keys(object(source.endpoints, 'PROVIDER_CONFIG_ENDPOINTS_INVALID')), 'PROVIDER_CONFIG_ENDPOINTS');
  const endpoints = Object.freeze(Object.fromEntries(Object.entries(endpointsSource).map(([operation, endpoint]) => {
    if (!operation.trim() || typeof endpoint !== 'string' || !endpoint.startsWith('/') || endpoint.startsWith('//')) throw new Error('PROVIDER_CONFIG_ENDPOINT_INVALID');
    return [operation, endpoint];
  })));
  const healthOperation = text(source.healthOperation, 'PROVIDER_CONFIG_HEALTH_INVALID');
  if (healthOperation !== expectedHealthOperation || endpoints[healthOperation] === undefined) throw new Error('PROVIDER_CONFIG_HEALTH_INVALID');
  const limitsSource = strictConfigObject(source.limits, LIMIT_KEYS, 'PROVIDER_CONFIG_LIMITS');
  const limits = Object.freeze({
    connectionTimeoutMs: bounded(limitsSource.connectionTimeoutMs, 50, 30_000, 'PROVIDER_CONFIG_CONNECTION_TIMEOUT_INVALID'),
    responseTimeoutMs: bounded(limitsSource.responseTimeoutMs, 50, 120_000, 'PROVIDER_CONFIG_RESPONSE_TIMEOUT_INVALID'),
    totalDeadlineMs: bounded(limitsSource.totalDeadlineMs, 100, 300_000, 'PROVIDER_CONFIG_DEADLINE_INVALID'),
    maxConcurrency: bounded(limitsSource.maxConcurrency, 1, 100, 'PROVIDER_CONFIG_CONCURRENCY_INVALID'),
    requestsPerSecond: bounded(limitsSource.requestsPerSecond, 1, 10_000, 'PROVIDER_CONFIG_RATE_INVALID'),
    maxAttempts: bounded(limitsSource.maxAttempts, 1, 5, 'PROVIDER_CONFIG_ATTEMPTS_INVALID'),
    failureThreshold: bounded(limitsSource.failureThreshold, 1, 100, 'PROVIDER_CONFIG_FAILURE_THRESHOLD_INVALID'),
    recoveryMs: bounded(limitsSource.recoveryMs, 100, 3_600_000, 'PROVIDER_CONFIG_RECOVERY_INVALID'),
  });
  if (limits.responseTimeoutMs < limits.connectionTimeoutMs || limits.totalDeadlineMs < limits.responseTimeoutMs) throw new Error('PROVIDER_CONFIG_TIMEOUT_ORDER_INVALID');
  return Object.freeze({ id, baseUrl, secretRef, endpoints, healthOperation, limits });
}

export function strictConfigObject(value: unknown, allowedKeys: readonly string[], prefix: string): Readonly<Record<string, unknown>> {
  const source = object(value, `${prefix}_INVALID`);
  const unknown = Object.keys(source).filter((key) => !allowedKeys.includes(key));
  if (unknown.length) throw new Error(`${prefix}_UNKNOWN_KEY:${unknown.join(',')}`);
  return source;
}

function object(value: unknown, code: string): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(code);
  return value as Readonly<Record<string, unknown>>;
}

function text(value: unknown, code: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(code);
  return value.trim();
}

function httpsUrl(value: unknown): string {
  const source = text(value, 'PROVIDER_CONFIG_BASE_URL_INVALID');
  const url = new URL(source);
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) throw new Error('PROVIDER_CONFIG_BASE_URL_INVALID');
  return url.toString();
}

function bounded(value: unknown, minimum: number, maximum: number, code: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum || value > maximum) throw new Error(code);
  return value;
}
