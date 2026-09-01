import { describe, expect, it, vi } from 'vitest';
import type { ProviderCallContext } from '@shop/contract';
import type { VendorConnection } from '@shop/vendorcore';
import { CakeuncleClient } from '../Client';

const now = 1_700_000_000_000;
const context: ProviderCallContext = { tenantId: 'tenant', requestId: 'request', traceId: 'trace', deadline: now + 5_000 };
const connection: VendorConnection = {
  id: 'cakeuncle-test', baseUrl: 'https://dev.dangaoss.cn',
  secret: { channelNo: 'channel-test', channelKey: 'secret-test', userId: 'user-1' },
  endpoints: { health: '/channelapi/product/get_products_list' }, healthOperation: 'health',
  limits: { connectionTimeoutMs: 500, responseTimeoutMs: 500, totalDeadlineMs: 2_000, maxConcurrency: 2,
    requestsPerSecond: 100, maxAttempts: 2, failureThreshold: 5, recoveryMs: 1_000 },
};

describe('cakeuncle client', () => {
  it('injects documented JSON authentication without exposing the key', async () => {
    const fetcher = vi.fn<typeof fetch>(async (_url, init) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      expect(body).toMatchObject({ page: 1, user_id: 'user-1', channel_no: 'channel-test', timestamp: '1700000000',
        sign: '748c9a0a8116a2851cc677da6723cc94' });
      expect(JSON.stringify(body)).not.toContain('secret-test');
      return new Response(JSON.stringify({ code: 200, msg: 'success', data: { products: [] } }), { status: 200 });
    });
    const client = new CakeuncleClient(connection, fetcher, () => now);
    await client.invoke(context, { operation: 'product.list', path: '/channelapi/product/get_products_list',
      idempotent: true, includeUserId: true, body: { page: 1 } });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('never retries a write with an unknown transport outcome', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response('unavailable', { status: 503 }));
    const client = new CakeuncleClient(connection, fetcher, () => now);
    await expect(client.invoke(context, { operation: 'order.submit', path: '/channelapi/order/submit_order',
      idempotent: false, body: { out_order_no: 'order-1' } })).rejects.toThrow('CAKEUNCLE_WRITE_OUTCOME_UNKNOWN');
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('fails closed on business errors', async () => {
    const fetcher: typeof fetch = async () => new Response(JSON.stringify({ code: 106, msg: 'bad sign' }), { status: 200 });
    const client = new CakeuncleClient(connection, fetcher, () => now);
    await expect(client.invoke(context, { operation: 'product.list', path: '/channelapi/product/get_products_list',
      idempotent: true, body: {} })).rejects.toThrow('CAKEUNCLE_API_106');
  });

  it('probes the configured read endpoint before reporting healthy', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ code: 200, msg: 'success', data: [] })));
    const client = new CakeuncleClient(connection, fetcher, () => now);
    await expect(client.health()).resolves.toBe(true);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('requires an API envelope and caps response bodies', async () => {
    const missingCode: typeof fetch = async () => new Response(JSON.stringify({ data: [] }));
    await expect(new CakeuncleClient(connection, missingCode, () => now).invoke(context,
      { operation: 'product.list', path: '/channelapi/product/get_products_list', idempotent: true, body: {} }))
      .rejects.toThrow('CAKEUNCLE_RESPONSE_CODE_MISSING');
    const oversized: typeof fetch = async () => new Response('{}', { headers: { 'content-length': '2097153' } });
    await expect(new CakeuncleClient(connection, oversized, () => now).invoke(context,
      { operation: 'product.list', path: '/channelapi/product/get_products_list', idempotent: true, body: {} }))
      .rejects.toThrow('VENDOR_RESPONSE_TOO_LARGE');
  });

  it('counts only transient failures toward the circuit', async () => {
    const strict = { ...connection, limits: { ...connection.limits, failureThreshold: 1, maxAttempts: 1 } };
    const permanent = new CakeuncleClient(strict, async () => new Response('{}', { status: 401 }), () => now);
    await expect(permanent.invoke(context, { operation: 'product.list', path: '/channelapi/product/get_products_list',
      idempotent: true, body: {} })).rejects.toThrow('VENDOR_HTTP_401');
    expect(permanent.circuitState()).toBe('closed');

    const transient = new CakeuncleClient(strict,
      async () => new Response(JSON.stringify({ code: 900, msg: 'retry' })), () => now);
    await expect(transient.invoke(context, { operation: 'product.list', path: '/channelapi/product/get_products_list',
      idempotent: true, body: {} })).rejects.toThrow('CAKEUNCLE_API_900');
    expect(transient.circuitState()).toBe('open');
  });
});
