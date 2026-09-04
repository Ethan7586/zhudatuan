import type { StorefrontSession } from '../../../entity/session';
import type { CartPort } from '../public/CartPort';

export class ChangeCart {
  constructor(private readonly gateway: Pick<CartPort, 'put'>) {}
  execute(session: StorefrontSession, input: Readonly<{ listingId: string; quantity: number; lineVersion: number | null; cartVersion: number }>) {
    const idempotencyKey = crypto.randomUUID();
    return this.gateway.put(session, { ...input, idempotencyKey });
  }
}
