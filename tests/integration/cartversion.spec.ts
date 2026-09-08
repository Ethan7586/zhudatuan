import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ItemsPutHandler } from '../../services/commerce/src/modules/cart/application/handler/ItemsPutHandler';
import { CartActor } from '../../services/commerce/src/modules/cart/application/service/CartActor';
import { CartReader } from '../../services/commerce/src/modules/cart/application/service/CartReader';
import { ChangeCart } from '../../services/commerce/src/modules/cart/application/service/ChangeCart';
import { Cart } from '../../services/commerce/src/modules/cart/domain/model/Cart';
import type { CartLineMutation, CartOffer } from '../../services/commerce/src/modules/cart/domain/model/CartLine';

test('two writes with the same cart version allow exactly one mutation', async () => {
  const carts = new SerialCart();
  const offers = { resolve: async () => new Map([['listing:one', offer()]]) };
  const actor = new CartActor({ member: async () => owner, anonymous: async () => ({ mall: owner.mall, application: owner.application }) } as never);
  const handler = new ItemsPutHandler(actor, new ChangeCart(carts as never, offers as never, new CartReader(offers as never)));
  const writes = await Promise.allSettled([handler.execute(request().input, context()), handler.execute(request().input, context())]);
  assert.equal(writes.filter(({ status }) => status === 'fulfilled').length, 1);
  assert.equal(writes.filter(({ status }) => status === 'rejected').length, 1);
  assert.equal(carts.version, 1);
  assert.equal(carts.mutations, 1);
});

class SerialCart {
  version = 0;
  mutations = 0;
  private cart = new Cart({ id: 'cart:one', owner, version: 0, updatedAt: new Date(0), lines: [] });
  private tail = Promise.resolve();
  private release: (() => void) | null = null;
  async lockOrCreate(_context: unknown, _owner: unknown, expected: number) {
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
    return this.cart;
  }
  async mutate(_context: unknown, _cart: Cart, changes: readonly CartLineMutation[]) {
    this.mutations += 1;
    this.version += 1;
    this.cart = new Cart({
      id: this.cart.id,
      owner: this.cart.owner,
      version: this.version,
      updatedAt: new Date(0),
      lines: changes.filter(({ quantity }) => quantity > 0).map((line) => ({ ...line, version: (line.version ?? -1) + 1 })),
    });
    this.release?.();
    this.release = null;
    return this.cart;
  }
}

const owner = Object.freeze({ kind: 'member' as const, member: 'member:one', mall: 'mall:one', application: 'application:one' });

function offer(): CartOffer {
  return Object.freeze({
    listing: 'listing:one', sku: 'sku:one', title: '福利商品', amountMinor: 100, currency: 'CNY', available: 10,
    benefitApplicable: true, listingVersion: 'listing:3', priceVersion: 'price:one', inventoryVersion: 'stock:one', code: 'valid',
  });
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
