import type { StorefrontSession } from '../../../entity/session';
import type { CheckoutPort } from '../public/CheckoutPort';

export class CommitOrder {
  constructor(private readonly gateway: Pick<CheckoutPort, 'commit'>) {}
  execute(session: StorefrontSession, quoteId: string, paymentScene: 'miniapp' | 'jsapi') {
    return this.gateway.commit(session, quoteId, paymentScene, crypto.randomUUID());
  }
}
