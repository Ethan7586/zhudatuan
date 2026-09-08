export interface ProviderFixtureResult {
  readonly body: Readonly<Record<string, unknown>>;
  readonly status: number;
}

export function providerFixtureResult(
  method: string | undefined,
  pathname: string,
  headers: Readonly<Record<string, string | string[] | undefined>>,
  providers: ReadonlySet<string>
): ProviderFixtureResult {
  if (method === 'GET' && pathname === '/health/ready') return Object.freeze({ status: 200, body: Object.freeze({ status: 'ready' }) });
  const match = /^\/v1\/providers\/([a-z][a-z0-9]{1,63})\/([a-z][a-z0-9]{1,63})$/.exec(pathname);
  if (method !== 'POST' || !match) return Object.freeze({ status: 404, body: Object.freeze({ code: 'PROVIDER_FIXTURE_ROUTE_NOT_FOUND' }) });
  const provider = match[1]!;
  const capability = match[2]!;
  if (!providers.has(provider)) return Object.freeze({ status: 404, body: Object.freeze({ code: 'PROVIDER_FIXTURE_UNKNOWN_PROVIDER' }) });
  const idempotencyKey = header(headers, 'x-idempotency-key');
  if (!idempotencyKey || idempotencyKey.length > 255) return Object.freeze({ status: 400, body: Object.freeze({ code: 'PROVIDER_FIXTURE_IDEMPOTENCY_REQUIRED' }) });
  const behavior = header(headers, 'x-provider-fixture-result') ?? 'accepted';
  if (behavior === 'throttled') return Object.freeze({ status: 429, body: Object.freeze({ code: 'PROVIDER_RATE_LIMITED', retryable: true }) });
  if (behavior === 'unavailable') return Object.freeze({ status: 503, body: Object.freeze({ code: 'PROVIDER_UNAVAILABLE', retryable: true }) });
  if (behavior === 'rejected') return Object.freeze({ status: 422, body: Object.freeze({ code: 'PROVIDER_REQUEST_REJECTED', retryable: false }) });
  if (behavior !== 'accepted') return Object.freeze({ status: 400, body: Object.freeze({ code: 'PROVIDER_FIXTURE_BEHAVIOR_INVALID' }) });
  return Object.freeze({ status: 200, body: Object.freeze({ provider, capability, idempotencyKey, state: 'accepted' }) });
}

function header(headers: Readonly<Record<string, string | string[] | undefined>>, name: string): string | undefined {
  const value = headers[name];
  return Array.isArray(value) ? value[0] : value;
}
