export class OrderPaidSubscriber {
  receive(eventId: string, scopeId: string, payload: Readonly<Record<string, unknown>>): Readonly<{ eventId: string; eventType: 'order.paid'; scopeId: string; orderId: string }> {
    return Object.freeze({ eventId, eventType: 'order.paid', scopeId, orderId: reference(payload.order) });
  }
}

function reference(value: unknown): string {
  if (typeof value !== 'string' || !value) throw new Error('REFERRAL_ORDER_REFERENCE_REQUIRED');
  return value;
}
