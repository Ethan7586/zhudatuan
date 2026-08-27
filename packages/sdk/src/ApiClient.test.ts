import { CONTRACT_VERSION } from '@shop/contract/version';
import { describe, expect, it } from 'vitest';
import { ApiClient } from './ApiClient';
import { createCatalogOperations } from './operations/catalog';
import { createOrderOperations } from './operations/order';
import { createRuntimeOperations } from './operations/runtime';
import type { RequestContext } from './RequestContext';
import type { Transport, TransportRequest, TransportResponse } from './Transport';

class RecordingTransport implements Transport {
  request?: TransportRequest;

  send(request: TransportRequest): Promise<TransportResponse> {
    this.request = request;
    return Promise.resolve({ status: 200, headers: {}, body: '{}' });
  }
}

describe('ApiClient contract identity', () => {
  it('pins every SDK request to the generated contract version', async () => {
    const transport = new RecordingTransport();
    const client = new ApiClient('https://shop.example', transport);
    await createRuntimeOperations(client).healthLive({}, context());
    expect(transport.request?.headers['x-contract-version']).toBe(CONTRACT_VERSION);
  });

  it('carries scope, access, command and proof evidence through one immutable context', async () => {
    const transport = new RecordingTransport();
    const client = new ApiClient('https://shop.example', transport);
    await createCatalogOperations(client).productsUpdate({ path: { productid: 'product:1' }, body: { title: 'updated' } }, {
      ...context(),
      scope: { kind: 'mall', id: 'mall:1' },
      accessVersion: 11,
      idempotencyKey: 'command:1',
      expectedVersion: 7,
      proof: 'proof:1',
    });
    expect(transport.request?.headers['x-scope-hint']).toBe('mall:1');
    expect(transport.request?.headers['x-access-version']).toBe('11');
    expect(transport.request?.headers['idempotency-key']).toBe('command:1');
    expect(transport.request?.headers['if-match']).toBe('"7"');
    expect(transport.request?.headers['x-action-proof']).toBe('proof:1');
  });

  it('refuses every browser mutation without caller-owned idempotency', async () => {
    const transport = new RecordingTransport();
    const client = new ApiClient('https://shop.example', transport);
    await expect(createOrderOperations(client).ordersCreate({ body: { quote: 'quote:one' } }, context()))
      .rejects.toThrow('SDK_IDEMPOTENCY_KEY_REQUIRED');
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
        return new Promise((_resolve, reject) => request.signal?.addEventListener('abort', () => {
          const cause: unknown = request.signal?.reason;
          reject(cause instanceof Error ? cause : new Error('REQUEST_ABORTED', { cause }));
        }, { once: true }));
      },
    });
    const pending = createCatalogOperations(client).listingsRead({}, { ...context(), signal: controller.signal });
    controller.abort(new Error('scope changed'));
    await expect(pending).rejects.toThrow('scope changed');
    expect(networkSignal?.aborted).toBe(true);
  });
});

function context(): RequestContext {
  return { contractVersion: CONTRACT_VERSION, traceId: 'trace:1', clientVersion: '1.0.0' };
}
