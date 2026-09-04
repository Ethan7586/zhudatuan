import type { CartAccess, CartPort } from '../public/CartPort';

export class ChangeCart {
  constructor(private readonly gateway: Pick<CartPort, 'put' | 'batch'>) {}
  execute(access: CartAccess, input: Readonly<{ listingId: string; quantity: number; selected?: boolean; lineVersion: number | null; cartVersion: number }>) {
    const idempotencyKey = crypto.randomUUID();
    return this.gateway.put(access, { ...input, idempotencyKey });
  }
  batch(access: CartAccess, cartVersion: number, items: readonly Readonly<{ listingId: string; quantity: number; selected?: boolean; lineVersion: number | null }>[]) {
    return this.gateway.batch(access, { cartVersion, items, idempotencyKey: crypto.randomUUID() });
  }
}
