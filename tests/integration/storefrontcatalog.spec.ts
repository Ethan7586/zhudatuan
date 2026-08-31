import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CatalogMapper } from '../../services/commerce/src/app/storefront/CatalogMapper';
import { CatalogQuery } from '../../services/commerce/src/app/storefront/CatalogQuery';

const mapper = new CatalogMapper('catalog-integration-signing-key-with-32-bytes');

test('storefront catalog composes listing, price and inventory concurrently without accepting caller scope', async () => {
  let active = 0;
  let maximum = 0;
  const parallel = async <T>(value: T) => {
    active += 1;
    maximum = Math.max(maximum, active);
    await Promise.resolve();
    active -= 1;
    return value;
  };
  const query = new CatalogQuery(
    { resolveHost: async () => ({ application: 'application:one', mall: 'mall:one', pool: 'pool:one', release: 'release:one', version: 'binding:1', tenant: 'tenant:one' }) },
    {
      listings: async (_scope, input) => {
        assert.equal(input.mall, 'mall:one');
        assert.equal(input.pool, 'pool:one');
        return {
          items: [{ id: 'listing:one', sku: 'sku:one', product: 'product:one', title: '福利商品', subtitle: null, coverUrl: null, kind: 'physical', version: 'listing:1', updatedAt: '2026-08-31T00:00:00.000Z' }],
          next: { sort: '2026-08-31T00:00:00.000Z', id: 'listing:one' },
        };
      },
    },
    { prices: async () => parallel([{ sku: 'sku:one', amountMinor: 100, compareMinor: 120, currency: 'CNY', version: 'price:1' }]) },
    { availability: async () => parallel([{ sku: 'sku:one', available: 8, state: 'available', version: 'stock:1' }]) },
    mapper
  );
  const result = await query.execute(request());
  const body = result.body as Record<string, any>;
  assert.equal(result.status, 200);
  assert.equal(body.items[0].price.amountMinor, 100);
  assert.equal(body.items[0].availability.available, 8);
  assert.equal(maximum, 2);
  assert.deepEqual(mapper.decode(body.nextCursor), { sort: '2026-08-31T00:00:00.000Z', id: 'listing:one' });
});

test('storefront catalog cursor is signed and fails closed after tampering', () => {
  const cursor = mapper.encode({ sort: '2026-08-31T00:00:00.000Z', id: 'listing:one' })!;
  assert.throws(() => mapper.decode(`${cursor}x`), /STOREFRONT_CURSOR_INVALID/);
});

function request() {
  return {
    type: 'storefront.catalog.read',
    input: { path: {}, query: { limit: '24' }, headers: { host: 'mall.example' }, body: undefined, rawBody: '', deadline: Date.now() + 1_000, signal: new AbortController().signal },
    security: { kind: 'anonymous', channel: 'public', target: 'storefront', trace: 'trace:catalog' },
  } as const;
}
