import { describe, expect, it } from 'vitest';
import { createCommerce, createRequestContext } from './index';
import type { TransportRequest } from './Transport';

describe('CommerceClient', () => {
  it('exposes generated domain methods without a generic call escape hatch', async () => {
    let request: TransportRequest | undefined;
    const client = createCommerce('https://shop.example', {
      send: (value) => {
        request = value;
        return Promise.resolve({ status: 200, headers: {}, body: '{"items":[]}' });
      },
    });

    const result = await client.catalog.listingsRead(
      { query: { page: 1, pagesize: 50 } },
      createRequestContext('1.0.0', { scope: { kind: 'mall', id: 'mall:1' }, traceId: 'trace:1' }),
    );

    expect(request?.url).toBe('https://shop.example/api/v1/catalog/listings?page=1&pagesize=50');
    expect(result).toEqual({ items: [] });
    expect('call' in client).toBe(false);
  });
});
