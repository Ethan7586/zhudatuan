import type { StorefrontSession } from '../../../shared/api/Session';
import { CartGateway } from '../infrastructure/CartGateway';

export class ChangeCart {
  execute(session: StorefrontSession, input: Readonly<{ listingId: string; quantity: number; lineVersion: number | null; cartVersion: number }>) {
    const idempotencyKey = crypto.randomUUID();
    return CartGateway.put(session, { ...input, idempotencyKey });
  }
}
