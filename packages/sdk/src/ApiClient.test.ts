import { CONTRACT_VERSION } from '@shop/contract/version';
import { RUNTIME_LIMITS } from '@shop/config/runtime';
import { parseStorefrontHandle } from '@shop/contract';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiClient } from './ApiClient';
import { createCatalogOperations } from './operations/catalog';
import { createOrderOperations } from './operations/order';
import { createIdentityOperations } from './operations/identity';
import { createRuntimeOperations } from './operations/runtime';
import { createSupportOperations } from './operations/support';
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
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

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
      kind: 'transport',
      code: 'CONTRACT_INVALID',
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

  it('preserves offline and timeout as distinct transport failures', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    const offline = new ApiClient('https://shop.example', { send: () => Promise.reject(new TypeError('network unavailable')) });
    await expect(createRuntimeOperations(offline).healthLive({}, context())).rejects.toMatchObject({ kind: 'transport', code: 'OFFLINE', operation: 'runtime.health.live' });

    vi.unstubAllGlobals();
    vi.useFakeTimers();
    const timeout = new ApiClient('https://shop.example', {
      send: (request) =>
        new Promise((_resolve, reject) =>
          request.signal?.addEventListener(
            'abort',
            () => {
              const reason: unknown = request.signal?.reason;
              reject(reason instanceof Error ? reason : new Error('REQUEST_ABORTED', { cause: reason }));
            },
            { once: true }
          )
        ),
    });
    const pending = createRuntimeOperations(timeout).healthLive({}, context());
    const timedOut = expect(pending).rejects.toMatchObject({ kind: 'transport', code: 'TIMEOUT', requestId: 'trace:1', retryable: true, operation: 'runtime.health.live' });
    await vi.advanceTimersByTimeAsync(RUNTIME_LIMITS.http.totalDeadlineMilliseconds);
    await timedOut;
  });

  it('surfaces rate limits once with the server retry window instead of retrying immediately', async () => {
    let calls = 0;
    const client = new ApiClient('https://shop.example', {
      send: () => {
        calls += 1;
        return Promise.resolve({
          status: 429,
          headers: {},
          body: JSON.stringify({ code: 'RATE_LIMITED', message: 'RATE_LIMITED', requestId: 'request:rate', retryable: true, retryAfter: 60 }),
        });
      },
    });

    await expect(createIdentityOperations(client).sessionsCreate(
      {
        body: {
          method: 'password',
          subject: 'employee:one',
          password: 'SecurePassword1!',
          target: 'storefront',
          returnTarget: 'signed-return-target',
          authorization: { state: 'state', nonce: 'nonce', challenge: 'challenge' },
        },
      },
      { ...context(), target: 'storefront', csrfToken: 'csrf', idempotencyKey: 'login:one' }
    )).rejects.toMatchObject({ kind: 'api', code: 'RATE_LIMITED', requestId: 'request:rate', retryable: true, retryAfter: 60 });
    expect(calls).toBe(1);
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
      kind: 'transport',
      code: 'CONTRACT_INVALID',
    });
  });

  it('returns only a contract-validated cached value for a declared 304 response', async () => {
    const client = new ApiClient('https://shop.example', { send: () => Promise.resolve({ status: 304, headers: { etag: '"health"' }, body: '' }) });
    const cached = { status: 'live', eventLoop: 'responsive' } as const;
    await expect(createRuntimeOperations(client).healthLive({}, { ...context(), ifNoneMatch: '"health"', cachedResponse: cached })).resolves.toEqual(cached);
    await expect(createRuntimeOperations(client).healthLive({}, { ...context(), ifNoneMatch: '"health"' })).rejects.toMatchObject({ kind: 'transport', code: 'CONTRACT_INVALID' });
  });

  it('opens stream operations with every authentication header and Last-Event-ID', async () => {
    let request: TransportRequest | undefined;
    const encoder = new TextEncoder();
    const client = new ApiClient('https://shop.example', {
      send: () => Promise.reject(new Error('UNEXPECTED_JSON_REQUEST')),
      open: (value) => {
        request = value;
        return Promise.resolve({
          status: 200,
          headers: { 'x-request-id': 'request:stream' },
          stream: new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(encoder.encode('id: event:2\ndata: {"id":"event:2","type":"support.message.sent","scopeId":"mall:one","ticketId":"ticket:one","conversationId":"conversation:one","messageId":"message:one","sequence":2,"version":3,"occurredAt":"2026-09-02T12:00:00.000Z"}\n\n'));
              controller.close();
            },
          }),
        });
      },
    });
    const stream = createSupportOperations(client).eventsRead(
      { query: { conversationId: 'conversation:one' } },
      {
        ...context(),
        target: 'console',
        scope: { kind: 'mall', id: 'mall:one' },
        accessVersion: 9,
        deviceId: 'device:one',
        lastEventId: 'event:1',
      }
    );

    await expect(stream[Symbol.asyncIterator]().next()).resolves.toMatchObject({ done: false, value: { id: 'event:2', sequence: 2 } });
    expect(request?.headers).toMatchObject({
      accept: 'text/event-stream',
      'last-event-id': 'event:1',
      'x-client-target': 'console',
      'x-scope-hint': 'mall:one',
      'x-access-version': '9',
      'x-device-id': 'device:one',
    });
    stream.close();
  });
});

function context(): RequestContext {
  return { contractVersion: CONTRACT_VERSION, traceId: 'trace:1', clientVersion: '1.0.0' };
}
