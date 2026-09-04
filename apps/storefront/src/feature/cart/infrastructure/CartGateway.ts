import type { CartOperations } from '@shop/sdk/cart';
import type { OperationOutputFor } from '@shop/contract';
import type { RequestContextFactory } from '../../../shared/api/RequestContext';
import type { CartSnapshot } from '../model/CartSnapshot';
import type { CartAccess, CartChange, CartPort } from '../public/CartPort';
import type { CartTokenStore } from './CartTokenStore';

export class CartGateway implements CartPort {
  constructor(
    private readonly cart: CartOperations,
    private readonly context: RequestContextFactory,
    private readonly tokens: CartTokenStore
  ) {}

  async read(access: CartAccess, signal?: AbortSignal): Promise<CartSnapshot> {
    const existing = this.tokens.existing();
    if (access.session && existing) {
      const value = await this.cart.anonymousMerge(
        { body: {} },
        this.context(access.session, { signal, write: true, csrfToken: access.csrfToken ?? undefined, cartToken: existing, idempotencyKey: crypto.randomUUID() })
      );
      if (value.merge !== 'blocked') this.tokens.clear();
      return snapshot(value);
    }
    const token = access.session ? undefined : this.tokens.current();
    const value = await this.cart.currentRead({}, this.context(access.session, { signal, ...(token ? { cartToken: token } : {}) }));
    return snapshot(value);
  }

  async put(access: CartAccess, input: CartChange): Promise<void> {
    const token = access.session ? undefined : this.tokens.current();
    await this.cart.itemsPut(
      { path: { listingid: input.listingId }, body: { quantity: input.quantity, lineVersion: input.lineVersion, ...(input.selected === undefined ? {} : { selected: input.selected }) } },
      this.context(access.session, { write: true, csrfToken: access.csrfToken ?? undefined, expectedVersion: input.cartVersion, idempotencyKey: input.idempotencyKey, ...(token ? { cartToken: token } : {}) })
    );
  }

  async batch(access: CartAccess, input: Readonly<{ cartVersion: number; idempotencyKey: string; items: readonly Omit<CartChange, 'cartVersion' | 'idempotencyKey'>[] }>): Promise<CartSnapshot> {
    const token = access.session ? undefined : this.tokens.current();
    const value = await this.cart.itemsBatch(
      { body: { items: input.items.map((item) => ({ listingId: item.listingId, quantity: item.quantity, lineVersion: item.lineVersion, ...(item.selected === undefined ? {} : { selected: item.selected }) })) } },
      this.context(access.session, { write: true, csrfToken: access.csrfToken ?? undefined, expectedVersion: input.cartVersion, idempotencyKey: input.idempotencyKey, ...(token ? { cartToken: token } : {}) })
    );
    return snapshot(value);
  }
}

function snapshot(value: OperationOutputFor<'cart.current.read'>): CartSnapshot {
  return Object.freeze({ version: value.version, merge: value.merge, mergeReason: value.merge_reason, items: Object.freeze(value.items.map((item) => Object.freeze({ ...item }))) });
}
