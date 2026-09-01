import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ItemsPutHandler } from '../../services/commerce/src/modules/cart/application/handler/ItemsPutHandler';

test('two writes with the same cart version allow exactly one mutation', async () => {
  const carts = new SerialCart();
  const handler = new ItemsPutHandler(
    carts as never,
    { resolve: async () => ({ member: 'member:one', mall: 'mall:one', application: 'application:one' }) } as never,
    {
      resolve: async () => new Map([['listing:one', { listing: 'listing:one', sku: 'sku:one', title: '福利商品', listingVersion: 'listing:3', unitMinor: 100, currency: 'CNY', priceVersion: 'price:one' }]]),
    } as never
  );
  const writes = await Promise.allSettled([handler.execute(request().input, context()), handler.execute(request().input, context())]);
  assert.equal(writes.filter(({ status }) => status === 'fulfilled').length, 1);
  assert.equal(writes.filter(({ status }) => status === 'rejected').length, 1);
  assert.equal(carts.version, 1);
  assert.equal(carts.mutations, 1);
});

class SerialCart {
  version = 0;
  mutations = 0;
  private tail = Promise.resolve();
  private release: (() => void) | null = null;
  async lockOrCreate(_database: unknown, _member: string, _mall: string, _application: string, expected: number) {
    let unlock!: () => void;
    const turn = new Promise<void>((resolve) => {
      unlock = resolve;
    });
    const previous = this.tail;
    this.tail = turn;
    await previous;
    if (expected !== this.version) {
      unlock();
      throw new Error('CART_VERSION_CONFLICT');
    }
    this.release = unlock;
    return 'cart:one';
  }
  async lineVersions() {
    return new Map<string, number>();
  }
  async mutate() {
    this.mutations += 1;
    this.version += 1;
    this.release?.();
    this.release = null;
  }
  async snapshot() {
    return { id: 'cart:one', mall_id: 'mall:one', application_id: 'application:one', version: this.version, updated_at: new Date(0), items: [] };
  }
}

function request() {
  return {
    type: 'cart.items.put',
    input: { path: { listingid: 'listing:one' }, query: {}, headers: {}, body: { quantity: 1, lineVersion: null }, rawBody: '', expectedVersion: 0, deadline: Date.now() + 1_000, signal: new AbortController().signal },
    security: { kind: 'session', access: access() },
  } as never;
}

function context() {
  const value = request();
  return {
    requestId: 'request:cart',
    traceId: 'trace:cart',
    operation: 'cart.items.put',
    deadline: value.input.deadline,
    signal: value.input.signal,
    expectedVersion: value.input.expectedVersion,
    transaction: {} as never,
    security: value.security,
    headers: value.input.headers,
    rawBody: value.input.rawBody,
  } as never;
}

function access() {
  return {
    actor: { id: 'principal:one', session: 'session:one', membership: 'membership:one', credentialVersion: 1, accessVersion: 1, target: 'storefront', assurance: { level: 2 } },
    membership: { id: 'membership:one', active: true, accessVersion: 1, permissions: { allows: new Set(), denies: new Set() }, scopes: [] },
    scope: { id: 'mall:one', kind: 'mall', path: [] },
    accessVersion: 1,
    capabilities: new Set(),
    capabilityVersion: 1,
    assurance: { level: 2 },
    trace: 'trace:cart',
  };
}
