import type { StorefrontClient } from '../../../shared/api/Client';
import type { StorefrontSession } from '../../../entity/session';

export class CartGateway {
  constructor(private readonly cart: StorefrontClient['commerce']['cart'], private readonly context: StorefrontClient['context']) {}
  read(session: StorefrontSession, signal?: AbortSignal) {
    return this.cart.currentRead({}, this.context(session, { signal }));
  }
  put(session: StorefrontSession, input: Readonly<{ listingId: string; quantity: number; lineVersion: number | null; cartVersion: number; idempotencyKey: string }>) {
    return this.cart.itemsPut(
      { path: { listingid: input.listingId }, body: { quantity: input.quantity, lineVersion: input.lineVersion } },
      this.context(session, { write: true, expectedVersion: input.cartVersion, idempotencyKey: input.idempotencyKey })
    );
  }
}
