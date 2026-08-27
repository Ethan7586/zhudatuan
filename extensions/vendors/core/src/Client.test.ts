import { describe, expect, it } from 'vitest';
import type { ProviderCallContext, ProviderLimit } from '@shop/contract';
import { HeaderAuthenticator } from './Auth';
import { VendorClient } from './Client';

const limits: ProviderLimit = {
  connectionTimeoutMs: 100,
  responseTimeoutMs: 100,
  totalDeadlineMs: 500,
  maxConcurrency: 2,
  requestsPerSecond: 100,
  maxAttempts: 2,
  failureThreshold: 3,
  recoveryMs: 100,
};

describe('VendorClient', () => {
  it('rejects undeclared operations before transport', async () => {
    const client = new VendorClient({ id: 'test', baseUrl: 'https://vendor.test', secret: { token: 'x' }, endpoints: { health: '/health' }, healthOperation: 'health', limits }, new HeaderAuthenticator('authorization', 'token'), async () => new Response('{}'));
    const context: ProviderCallContext = { tenantId: 't', requestId: 'r', traceId: 'trace', deadline: Date.now() + 1000 };
    await expect(client.invoke(context, { operation: 'missing', method: 'GET', idempotent: true })).rejects.toThrow('VENDOR_OPERATION_NOT_CONFIGURED');
  });

  it('retries an idempotent operation and preserves the request context', async () => {
    let calls = 0;
    const client = new VendorClient({ id: 'test', baseUrl: 'https://vendor.test', secret: { token: 'x' }, endpoints: { health: '/health', read: '/read' }, healthOperation: 'health', limits }, new HeaderAuthenticator('authorization', 'token'), async (_url, init) => {
      calls += 1;
      expect(new Headers(init?.headers).get('x-request-id')).toBe('r');
      return calls === 1 ? new Response('{}', { status: 503 }) : new Response('{"ok":true}');
    });
    const context: ProviderCallContext = { tenantId: 't', requestId: 'r', traceId: 'trace', deadline: Date.now() + 1000 };
    await expect(client.invoke(context, { operation: 'read', method: 'GET', idempotent: true })).resolves.toEqual({ ok: true });
    expect(calls).toBe(2);
  });

  it('never retries a non-idempotent write without an idempotency key', async () => {
    let calls = 0;
    const client = new VendorClient({ id: 'test', baseUrl: 'https://vendor.test', secret: { token: 'x' }, endpoints: { health: '/health', write: '/write' }, healthOperation: 'health', limits }, new HeaderAuthenticator('authorization', 'token'), async () => { calls += 1; return new Response('{}', { status: 503 }); });
    const context: ProviderCallContext = { tenantId: 't', requestId: 'r', traceId: 'trace', deadline: Date.now() + 1000 };
    await expect(client.invoke(context, { operation: 'write', method: 'POST', idempotent: false, body: {} })).rejects.toThrow('VENDOR_HTTP_503');
    expect(calls).toBe(1);
  });

  it('opens an isolated circuit after the signed failure threshold', async () => {
    let calls = 0;
    const strict = { ...limits, maxAttempts: 1, failureThreshold: 1 };
    const client = new VendorClient({ id: 'test', baseUrl: 'https://vendor.test', secret: { token: 'x' }, endpoints: { health: '/health', read: '/read' }, healthOperation: 'health', limits: strict }, new HeaderAuthenticator('authorization', 'token'), async () => { calls += 1; return new Response('{}', { status: 503 }); });
    const context: ProviderCallContext = { tenantId: 't', requestId: 'r', traceId: 'trace', deadline: Date.now() + 1000 };
    await expect(client.invoke(context, { operation: 'read', method: 'GET', idempotent: true })).rejects.toThrow('VENDOR_HTTP_503');
    await expect(client.invoke(context, { operation: 'read', method: 'GET', idempotent: true })).rejects.toThrow('VENDOR_CIRCUIT_OPEN');
    expect(calls).toBe(1);
  });
});
