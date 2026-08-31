import type { StorefrontSession } from '../../../shared/api/Session';
import { OrderGateway } from '../infrastructure/OrderGateway';

export class ReceiveOrder {
  execute(session: StorefrontSession, orderId: string, expectedVersion: number) {
    return OrderGateway.receive(session, orderId, expectedVersion, crypto.randomUUID());
  }
}
