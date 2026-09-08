import type { Payment } from '../model/Payment';
import type { OperationOutputFor } from '@shop/contract';

export function mapPayment(value: OperationOutputFor<'payment.intents.read'>): Payment {
  const action = value.action && typeof value.action === 'object' && !Array.isArray(value.action) ? Object.freeze({ parameters: Object.freeze(value.action as Readonly<Record<string, string>>) }) : null;
  return Object.freeze({
    intentId: String(value.intentId),
    orderId: String(value.orderId),
    paymentId: String(value.paymentId),
    state: value.state,
    action,
    expiresAt: String(value.expiresAt),
    retryAfter: value.retryAfter,
  });
}
