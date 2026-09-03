import type { StorefrontSession } from '../../../entity/session';
import { PaymentGateway } from '../infrastructure/PaymentGateway';
import { mapPayment } from '../infrastructure/PaymentMapper';

export class ReadPayment {
  constructor(private readonly gateway: Pick<PaymentGateway, 'read'>) {}
  async execute(session: StorefrontSession, paymentId: string, signal?: AbortSignal) {
    return mapPayment(await this.gateway.read(session, paymentId, signal));
  }
}
