import { describe, expect, it } from 'vitest';
import type { ProviderCallContext, ProviderLimit } from '@shop/contract';
import { HeaderAuthenticator } from '../src/integration/Auth';
import { redactProviderValue, RequestExecutor, type ProviderRequestMetric } from '../src/RequestExecutor';

const limits: ProviderLimit = { connectionTimeoutMs: 100, responseTimeoutMs: 100, totalDeadlineMs: 500, maxConcurrency: 2, requestsPerSecond: 100, maxAttempts: 2, failureThreshold: 3, recoveryMs: 100 };

describe('RequestExecutor', () => {
  it('rejects undeclared operations before transport', async () => {
    const client = executor(async () => new Response('{}'));
    await expect(client.invoke(context(), { operation: 'missing', method: 'GET', idempotent: true })).rejects.toThrow('PROVIDER_OPERATION_NOT_CONFIGURED');
  });

  it('retries idempotent operations with jitter and preserves trace context', async () => {
    let calls = 0;
    const client = executor(async (_url, init) => {
      calls += 1;
      expect(new Headers(init?.headers).get('x-request-id')).toBe('r');
      expect(new Headers(init?.headers).get('x-trace-id')).toBe('trace');
      return calls === 1 ? new Response('{}', { status: 503 }) : new Response('{"ok":true}');
    });
    await expect(client.invoke(context(), { operation: 'read', method: 'GET', idempotent: true })).resolves.toEqual({ ok: true });
    expect(calls).toBe(2);
  });

  it('never retries unsafe writes and isolates the circuit', async () => {
    let calls = 0;
    const strict = { ...limits, maxAttempts: 1, failureThreshold: 1 };
    const client = executor(async () => { calls += 1; return new Response('{}', { status: 503 }); }, strict);
    await expect(client.invoke(context(false), { operation: 'write', method: 'POST', idempotent: false, body: {} })).rejects.toThrow('PROVIDER_HTTP_503');
    await expect(client.invoke(context(), { operation: 'read', method: 'GET', idempotent: true })).rejects.toThrow('PROVIDER_CIRCUIT_OPEN');
    expect(calls).toBe(1);
  });

  it('distinguishes connection timeout from the total deadline', async () => {
    const strict = { ...limits, connectionTimeoutMs: 10, responseTimeoutMs: 20, totalDeadlineMs: 100, maxAttempts: 1 };
    const client = executor(abortableFetch(), strict);
    await expect(client.invoke(context(), { operation: 'read', method: 'GET', idempotent: true })).rejects.toThrow('PROVIDER_CONNECTION_TIMEOUT');
  });

  it('cancels rate admission immediately when the caller aborts', async () => {
    const strict = { ...limits, requestsPerSecond: 0.01, totalDeadlineMs: 5_000, maxAttempts: 1 };
    const client = executor(async () => new Response('{"ok":true}'), strict);
    await client.invoke(context(), { operation: 'read', method: 'GET', idempotent: true });
    const controller = new AbortController();
    const pending = client.invoke({ ...context(), signal: controller.signal }, { operation: 'read', method: 'GET', idempotent: true });
    controller.abort(new Error('USER_CANCELLED'));
    await expect(pending).rejects.toThrow('PROVIDER_REQUEST_CANCELLED');
  });

  it('stops an active transport when the caller cancels the task', async () => {
    const client = executor(abortableFetch(), { ...limits, maxAttempts: 1 });
    const controller = new AbortController();
    const pending = client.invoke({ ...context(), signal: controller.signal }, { operation: 'read', method: 'GET', idempotent: true });
    controller.abort(new Error('USER_CANCELLED'));
    await expect(pending).rejects.toThrow('PROVIDER_REQUEST_CANCELLED');
  });

  it('emits bounded metrics and recursively redacts secrets', async () => {
    const metrics: ProviderRequestMetric[] = [];
    const client = executor(async () => new Response('{"ok":true}'), limits, { record: (metric) => metrics.push(metric) });
    await client.invoke(context(), { operation: 'read', method: 'GET', idempotent: true });
    expect(metrics).toMatchObject([{ connectionId: 'test', operation: 'read', traceId: 'trace', outcome: 'succeeded' }]);
    expect(redactProviderValue({ token: 'secret', nested: { privateKey: 'key', safe: 'value' } })).toEqual({ token: '[REDACTED]', nested: { privateKey: '[REDACTED]', safe: 'value' } });
  });
});

function executor(fetcher: typeof fetch, selectedLimits: ProviderLimit = limits, telemetry?: { record(metric: ProviderRequestMetric): void }): RequestExecutor {
  return new RequestExecutor({ id: 'test', baseUrl: 'https://vendor.test', secret: { token: 'x' }, endpoints: { health: '/health', read: '/read', write: '/write' }, healthOperation: 'health', limits: selectedLimits }, new HeaderAuthenticator('authorization', 'token'), fetcher, telemetry);
}

function context(withKey = true): ProviderCallContext {
  return { tenantId: 't', requestId: 'r', traceId: 'trace', ...(withKey ? { idempotencyKey: 'key' } : {}), deadline: Date.now() + 1_000 };
}

function abortableFetch(): typeof fetch {
  return ((_url: URL | RequestInfo, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal;
      const abort = () => reject(new DOMException('aborted', 'AbortError'));
      if (signal?.aborted) abort();
      else signal?.addEventListener('abort', abort, { once: true });
    })) as typeof fetch;
}
