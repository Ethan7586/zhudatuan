import type { StorefrontSession } from '../../../entity/session';
import type { CheckoutPort, PaymentScene } from '../public/CheckoutPort';

export class CommitOrder {
  constructor(private readonly gateway: Pick<CheckoutPort, 'commit'>) {}
  execute(session: StorefrontSession, quoteId: string, confirmationToken: string, paymentScene: PaymentScene) {
    return this.gateway.commit(session, quoteId, confirmationToken, paymentScene, crypto.randomUUID());
  }
}
