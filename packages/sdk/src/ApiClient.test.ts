import { CONTRACT_VERSION } from '@shop/contract/version';
import { parseStorefrontHandle } from '@shop/contract';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiClient } from './ApiClient';
import { createCatalogOperations } from './operations/catalog';
import { createOrderOperations } from './operations/order';
import { createIdentityOperations } from './operations/identity';
import { createRuntimeOperations } from './operations/runtime';
import type { RequestContext } from './RequestContext';
import type { Transport, TransportRequest, TransportResponse } from './Transport';

class RecordingTransport implements Transport {
  request?: TransportRequest;

  constructor(private readonly body = JSON.stringify({ status: 'live', eventLoop: 'responsive' })) {}

  send(request: TransportRequest): Promise<TransportResponse> {
    this.request = request;
    return Promise.resolve({ status: 200, headers: {}, body: this.body });
  }
}

describe('ApiClient contract identity', () => {
  afterEach(() => vi.useRealTimers());

  it('pins every SDK request to the generated contract version', async () => {
    const transport = new RecordingTransport();
    const client = new ApiClient('https://shop.example', transport);
    await createRuntimeOperations(client).healthLive({}, context());
    expect(transport.request?.headers['x-contract-version']).toBe(CONTRACT_VERSION);
  });

  it('carries scope, access, command and proof evidence through one immutable context', async () => {
    const transport = new RecordingTransport(
      JSON.stringify({
        id: 'product:1',
        scope_id: 'mall:1',
        owner_partner_id: null,
        brand_id: null,
        category_id: 'category:1',
        title: 'updated',
        product_type: 'physical',
        attributes: {},
        status: 'active',
        version: 8,
        created_at: '2026-08-30T10:00:00.000Z',
        updated_at: '2026-08-30T10:01:00.000Z',
      })
    );
    const client = new ApiClient('https://shop.example', transport);
    await createCatalogOperations(client).productsUpdate(
      { path: { productid: 'product:1' }, body: { title: 'updated' } },
      {
        ...context(),
        scope: { kind: 'mall', id: 'mall:1' },
        storefrontHandle: parseStorefrontHandle('mall-one'),
        accessVersion: 11,
        idempotencyKey: 'command:1',
        expectedVersion: 7,
        proof: 'proof:1',
      }
    );
    expect(transport.request?.headers['x-scope-hint']).toBe('mall:1');
    expect(transport.request?.headers['x-storefront-handle']).toBe('mall-one');
    expect(transport.request?.headers['x-access-version']).toBe('11');
    expect(transport.request?.headers['idempotency-key']).toBe('command:1');
    expect(transport.request?.headers['if-match']).toBe('"7"');
    expect(transport.request?.headers['x-action-proof']).toBe('proof:1');
  });

  it('refuses every browser mutation without caller-owned idempotency', async () => {
    const transport = new RecordingTransport();
    const client = new ApiClient('https://shop.example', transport);
    await expect(createOrderOperations(client).ordersCreate({ body: { quote: 'quote:one' } }, context())).rejects.toThrow('SDK_IDEMPOTENCY_KEY_REQUIRED');
    expect(transport.request).toBeUndefined();
  });

  it('rejects a response that does not parse as JSON before it reaches a Feature', async () => {
    const client = new ApiClient('https://shop.example', {
      send: () => Promise.resolve({ status: 200, headers: {}, body: '{' }),
    });
    await expect(createRuntimeOperations(client).healthLive({}, context())).rejects.toMatchObject({
      code: 'CONTRACT_RESPONSE_INVALID',
      status: 502,
    });
  });

  it('forwards caller cancellation to the actual transport request', async () => {
    const controller = new AbortController();
    let networkSignal: AbortSignal | undefined;
    const client = new ApiClient('https://shop.example', {
      send: (request) => {
        networkSignal = request.signal;
        return new Promise((_resolve, reject) =>
          request.signal?.addEventListener(
            'abort',
            () => {
              const cause: unknown = request.signal?.reason;
              reject(cause instanceof Error ? cause : new Error('REQUEST_ABORTED', { cause }));
            },
            { once: true }
          )
        );
      },
    });
    const pending = createCatalogOperations(client).listingsRead({}, { ...context(), signal: controller.signal });
    controller.abort(new Error('scope changed'));
    await expect(pending).rejects.toThrow('scope changed');
    expect(networkSignal?.aborted).toBe(true);
  });

  it('keeps service SLO budgets separate from the public network deadline', async () => {
    vi.useFakeTimers();
    const client = new ApiClient('https://shop.example', {
      send: (request) =>
        new Promise((resolve, reject) => {
          const timer = setTimeout(() => resolve({ status: 200, headers: {}, body: JSON.stringify({ status: 'live', eventLoop: 'responsive' }) }), 1_000);
          request.signal?.addEventListener(
            'abort',
            () => {
              clearTimeout(timer);
              const cause: unknown = request.signal?.reason;
              reject(cause instanceof Error ? cause : new Error('REQUEST_ABORTED', { cause }));
            },
            { once: true }
          );
        }),
    });

    const pending = createRuntimeOperations(client).healthLive({}, context());
    await vi.advanceTimersByTimeAsync(1_000);
    await expect(pending).resolves.toEqual({ status: 'live', eventLoop: 'responsive' });
  });

  it('returns a contract-validated Location for a declared 303 operation', async () => {
    const client = new ApiClient('https://shop.example', { send: () => Promise.resolve({ status: 303, headers: { location: 'https://shop.example/complete' }, body: '' }) });
    await expect(createIdentityOperations(client).federationsComplete({ body: { membershipid: 'membership:one' } }, { ...context(), target: 'storefront', csrfToken: 'csrf', idempotencyKey: 'selection:one' })).resolves.toEqual({
      location: 'https://shop.example/complete',
    });
  });

  it('fails closed when a declared redirect omits Location', async () => {
    const client = new ApiClient('https://shop.example', { send: () => Promise.resolve({ status: 303, headers: {}, body: '' }) });
    await expect(createIdentityOperations(client).federationsComplete({ body: { membershipid: 'membership:one' } }, { ...context(), target: 'storefront', csrfToken: 'csrf', idempotencyKey: 'selection:one' })).rejects.toMatchObject({
      code: 'CONTRACT_RESPONSE_INVALID',
      status: 502,
    });
  });

  it('returns only a contract-validated cached value for a declared 304 response', async () => {
    const client = new ApiClient('https://shop.example', { send: () => Promise.resolve({ status: 304, headers: { etag: '"health"' }, body: '' }) });
    const cached = { status: 'live', eventLoop: 'responsive' } as const;
    await expect(createRuntimeOperations(client).healthLive({}, { ...context(), ifNoneMatch: '"health"', cachedResponse: cached })).resolves.toEqual(cached);
    await expect(createRuntimeOperations(client).healthLive({}, { ...context(), ifNoneMatch: '"health"' })).rejects.toMatchObject({ code: 'CONTRACT_RESPONSE_INVALID', status: 502 });
  });
});

function context(): RequestContext {
  return { contractVersion: CONTRACT_VERSION, traceId: 'trace:1', clientVersion: '1.0.0' };
}
