import type { StorefrontSession } from '../../../shared/api/Session';
import { OrderGateway } from '../infrastructure/OrderGateway';

export class RemindOrder {
  execute(session: StorefrontSession, orderId: string) {
    return OrderGateway.remind(session, orderId, crypto.randomUUID());
  }
}
