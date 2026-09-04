import type { StorefrontSession } from '../../../entity/session';
import type { Payment } from '../model/Payment';

export interface PaymentPort {
  read(session: StorefrontSession, paymentId: string, signal?: AbortSignal): Promise<Payment>;
}
