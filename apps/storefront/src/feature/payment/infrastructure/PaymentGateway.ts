import type { StorefrontClient } from '../../../shared/api/Client';
import type { StorefrontSession } from '../../../entity/session';

export class PaymentGateway {
  constructor(private readonly payment: StorefrontClient['commerce']['payment'], private readonly context: StorefrontClient['context']) {}
  read(session: StorefrontSession, paymentId: string, signal?: AbortSignal) {
    return this.payment.intentsRead({ path: { paymentid: paymentId } }, this.context(session, { signal }));
  }
}
