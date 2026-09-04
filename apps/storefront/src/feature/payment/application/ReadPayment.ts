import type { StorefrontSession } from '../../../entity/session';
import type { PaymentPort } from '../public/PaymentPort';

export class ReadPayment {
  constructor(private readonly gateway: Pick<PaymentPort, 'read'>) {}
  async execute(session: StorefrontSession, paymentId: string, signal?: AbortSignal) {
    return this.gateway.read(session, paymentId, signal);
  }
}
