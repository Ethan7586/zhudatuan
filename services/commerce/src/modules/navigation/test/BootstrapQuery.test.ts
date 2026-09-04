import { describe, expect, it } from 'vitest';
import { BootstrapQuery } from '../application/service/BootstrapQuery';

describe('storefront bootstrap cache boundary', () => {
  it('never stores an anonymous identity partition in a public browser cache', async () => {
    const query = new BootstrapQuery({
      identity: { resolve: () => Object.freeze({ state: 'anonymous', member: null, membership: null, scope: null, version: 0 }) },
      membership: {},
      member: {},
      benefit: {},
      order: {},
      navigation: { storefront: () => Object.freeze({ items: Object.freeze([]), version: 'navigation:1' }) },
      experience: {
        resolveEntry: async () =>
          Object.freeze({
            application: 'application:one',
            handle: 'mall-one',
            url: 'https://shop.test/s/mall-one',
            mall: 'mall:one',
            pool: 'pool:one',
            release: 'release:one',
            version: 'version:one',
            tenant: 'tenant:one',
            contentHash: 'a'.repeat(64),
            objectKey: 'experience/application:one/a.json',
          }),
        published: async () => Object.freeze({ document: Object.freeze({ pages: [] }), version: 'version:one', asOf: '2026-09-01T00:00:00.000Z' }),
      },
    } as never);
    const response = await query.execute({ path: {}, query: {} } as never, {
      operation: 'storefront.bootstrap.read',
      requestId: 'request:bootstrap',
      traceId: 'trace:bootstrap',
      deadline: Date.now() + 5_000,
      signal: new AbortController().signal,
      headers: Object.freeze({ 'x-storefront-handle': 'mall-one' }),
      rawBody: '',
      publicActor: 'anonymous:storefront',
      security: Object.freeze({ kind: 'anonymous', channel: 'public', target: 'storefront', trace: 'trace:bootstrap' }),
      transaction: Object.freeze({}) as never,
    });

    expect(response.headers).toEqual({ 'cache-control': 'private,no-store' });
    expect((response.body.identity as Readonly<{ data: Readonly<{ state: string }> }>).data.state).toBe('anonymous');
  });
});
