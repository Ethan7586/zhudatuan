import type { Payment } from '../model/Payment';

export function mapPayment(value: Readonly<Record<string, unknown>>): Payment {
  const action = value.action && typeof value.action === 'object' && !Array.isArray(value.action) ? Object.freeze({ parameters: Object.freeze(value.action as Readonly<Record<string, string>>) }) : null;
  return Object.freeze({
    intentId: String(value.intentId),
    orderId: String(value.orderId),
    paymentId: String(value.paymentId),
    state: value.state as Payment['state'],
    action,
    expiresAt: String(value.expiresAt),
    retryAfter: Number.isSafeInteger(value.retryAfter) ? Number(value.retryAfter) : null,
  });
}
