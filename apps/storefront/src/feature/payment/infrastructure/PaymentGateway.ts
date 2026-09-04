import type { PaymentOperations } from '@shop/sdk/payment';
import type { RequestContextFactory } from '../../../shared/api/RequestContext';
import type { StorefrontSession } from '../../../entity/session';
import type { Payment } from '../model/Payment';
import type { PaymentPort } from '../public/PaymentPort';
import { mapPayment } from './PaymentMapper';

export class PaymentGateway implements PaymentPort {
  constructor(
    private readonly payment: PaymentOperations,
    private readonly context: RequestContextFactory
  ) {}
  async read(session: StorefrontSession, paymentId: string, signal?: AbortSignal): Promise<Payment> {
    return mapPayment(await this.payment.intentsRead({ path: { paymentid: paymentId } }, this.context(session, { signal })));
  }
}
