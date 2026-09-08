import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CatalogMapper } from '../../services/commerce/src/modules/navigation/application/service/CatalogMapper';
import { CatalogQuery } from '../../services/commerce/src/modules/navigation/application/service/CatalogQuery';
import { result as databaseResult, withReadTransaction } from '../../services/commerce/src/test/TransactionFixture';

const mapper = new CatalogMapper('catalog-integration-signing-key-with-32-bytes');

test('storefront catalog composes listing, price, inventory and qualification concurrently without accepting caller scope', async () => {
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
    {
      resolveEntry: async () => ({
        application: 'application:one',
        handle: 'mall-one',
        url: 'https://fufu.wang/s/mall-one',
        mall: 'mall:one',
        pool: 'pool:one',
        release: 'release:one',
        version: 'version:1',
        tenant: 'tenant:one',
        contentHash: 'hash:one',
        objectKey: 'experience/mall-one/hash.json',
      }),
    },
    {
      listings: async (_scope, input) => {
        assert.equal(input.mall, 'mall:one');
        assert.equal(input.pool, 'pool:one');
        return {
          items: [{ id: 'listing:one', sku: 'sku:one', product: 'product:one', title: '福利商品', subtitle: null, coverUrl: null, kind: 'physical', categoryId: 'category:one', categoryCode: 'gift', categoryName: '员工好礼', brandId: null, supplierId: 'partner:one', attributes: {}, version: 'listing:1', updatedAt: '2026-08-31T00:00:00.000Z' }],
          next: { sort: '2026-08-31T00:00:00.000Z', id: 'listing:one' },
        };
      },
      categories: async () => [],
    },
    { prices: async () => parallel([{ sku: 'sku:one', amountMinor: 100, compareMinor: 120, currency: 'CNY', version: 'price:1' }]) },
    { availability: async () => parallel([{ sku: 'sku:one', available: 8, state: 'available', version: 'stock:1' }]) },
    { decisions: async () => parallel([{ listing: 'listing:one', eligible: true, policyVersion: 1 }]) },
    mapper
  );
  const response = await withReadTransaction(
    async () => databaseResult([]),
    (transaction) => query.execute({ query: { limit: '24' } } as never, context(transaction))
  );
  const body = response.body as Record<string, any>;
  assert.equal(response.status, 200);
  assert.equal(body.items[0].price.amountMinor, 100);
  assert.equal(body.items[0].availability.available, 8);
  assert.equal(maximum, 3);
  assert.deepEqual(mapper.decode(body.nextCursor), { sort: '2026-08-31T00:00:00.000Z', id: 'listing:one' });
});

test('storefront catalog cursor is signed and fails closed after tampering', () => {
  const cursor = mapper.encode({ sort: '2026-08-31T00:00:00.000Z', id: 'listing:one' })!;
  assert.throws(() => mapper.decode(`${cursor}x`), /STOREFRONT_CURSOR_INVALID/);
});

function context(transaction: unknown) {
  return {
    requestId: 'request:catalog',
    traceId: 'trace:catalog',
    operation: 'storefront.catalog.read',
    transaction,
    headers: { 'x-storefront-handle': 'mall-one' },
    rawBody: '',
    deadline: Date.now() + 1_000,
    signal: new AbortController().signal,
    security: { kind: 'anonymous', channel: 'public', target: 'storefront', trace: 'trace:catalog' },
    publicActor: 'public:catalog',
  } as never;
}
