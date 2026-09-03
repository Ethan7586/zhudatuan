import type { StorefrontSession } from '../../../entity/session';
import { CheckoutGateway } from '../infrastructure/CheckoutGateway';

export class CommitOrder {
  constructor(private readonly gateway: Pick<CheckoutGateway, 'commit'>) {}
  execute(session: StorefrontSession, quoteId: string, paymentScene: 'miniapp' | 'jsapi') {
    return this.gateway.commit(session, quoteId, paymentScene, crypto.randomUUID());
  }
}
