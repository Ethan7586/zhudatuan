import type { StorefrontSession } from '../../../entity/session';
import { CartGateway } from '../infrastructure/CartGateway';

export class ChangeCart {
  constructor(private readonly gateway: Pick<CartGateway, 'put'>) {}
  execute(session: StorefrontSession, input: Readonly<{ listingId: string; quantity: number; lineVersion: number | null; cartVersion: number }>) {
    const idempotencyKey = crypto.randomUUID();
    return this.gateway.put(session, { ...input, idempotencyKey });
  }
}
