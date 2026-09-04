import type { PaymentCancellationEvent } from '../../application/port/PaymentCancellationProcess';

export class OrderCancelledSubscriber {
  receive(eventId: string, scopeId: string, payload: Readonly<Record<string, unknown>>): PaymentCancellationEvent {
    return Object.freeze({
      eventId: text(eventId, 'PAYMENT_CANCELLATION_EVENT_REQUIRED'),
      scopeId: text(scopeId, 'PAYMENT_CANCELLATION_SCOPE_REQUIRED'),
      orderId: text(payload.order, 'PAYMENT_CANCELLATION_ORDER_REQUIRED'),
      reason: text(payload.reason, 'PAYMENT_CANCELLATION_REASON_REQUIRED'),
    });
  }
}

function text(value: unknown, code: string): string {
  if (typeof value !== 'string' || !value) throw new Error(code);
  return value;
}
