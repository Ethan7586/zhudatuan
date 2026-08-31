import { storefrontClient } from '../../../shared/api/Client';
import type { StorefrontSession } from '../../../shared/api/Session';

export const CartGateway = Object.freeze({
  read(session: StorefrontSession, signal?: AbortSignal) {
    return storefrontClient.commerce.cart.currentRead({}, storefrontClient.context(session, { signal }));
  },
  put(session: StorefrontSession, input: Readonly<{ listingId: string; quantity: number; lineVersion: number | null; cartVersion: number; idempotencyKey: string }>) {
    return storefrontClient.commerce.cart.itemsPut(
      { path: { listingid: input.listingId }, body: { quantity: input.quantity, lineVersion: input.lineVersion } },
      storefrontClient.context(session, { write: true, expectedVersion: input.cartVersion, idempotencyKey: input.idempotencyKey })
    );
  },
});
