import type { CartOperations } from '@shop/sdk/cart';
import type { RequestContextFactory } from '../../../shared/api/RequestContext';
import type { StorefrontSession } from '../../../entity/session';
import type { CartSnapshot } from '../model/CartSnapshot';
import type { CartChange, CartPort } from '../public/CartPort';

export class CartGateway implements CartPort {
  constructor(
    private readonly cart: CartOperations,
    private readonly context: RequestContextFactory
  ) {}
  async read(session: StorefrontSession, signal?: AbortSignal): Promise<CartSnapshot> {
    const value = await this.cart.currentRead({}, this.context(session, { signal }));
    return Object.freeze({ version: value.version, items: Object.freeze(value.items.map((item) => Object.freeze({ listing: item.listing, sku: item.sku, quantity: item.quantity, version: item.version }))) });
  }
  async put(session: StorefrontSession, input: CartChange): Promise<void> {
    await this.cart.itemsPut(
      { path: { listingid: input.listingId }, body: { quantity: input.quantity, lineVersion: input.lineVersion } },
      this.context(session, { write: true, expectedVersion: input.cartVersion, idempotencyKey: input.idempotencyKey })
    );
  }
}
