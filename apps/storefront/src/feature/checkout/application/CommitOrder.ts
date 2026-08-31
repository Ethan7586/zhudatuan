import type { StorefrontSession } from '../../../shared/api/Session';
import { CheckoutGateway } from '../infrastructure/CheckoutGateway';

export class CommitOrder {
  execute(session: StorefrontSession, quoteId: string, paymentScene: 'miniapp' | 'jsapi') {
    return CheckoutGateway.commit(session, quoteId, paymentScene, crypto.randomUUID());
  }
}
