import type { StorefrontSession } from '../../../shared/api/Session';
import { PaymentGateway } from '../infrastructure/PaymentGateway';
import { mapPayment } from '../infrastructure/PaymentMapper';

export async function readPayment(session: StorefrontSession, paymentId: string, signal?: AbortSignal) {
  const value = await PaymentGateway.read(session, paymentId, signal);
  return mapPayment(value);
}
