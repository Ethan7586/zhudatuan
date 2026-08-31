export class OrderReceivedSubscriber {
  receive(eventId: string, scopeId: string, payload: Readonly<Record<string, unknown>>): Readonly<{ eventId: string; eventType: 'order.received'; scopeId: string; orderId: string }> {
    return Object.freeze({ eventId, eventType: 'order.received', scopeId, orderId: reference(payload.orderId) });
  }
}

function reference(value: unknown): string {
  if (typeof value !== 'string' || !value) throw new Error('REFERRAL_ORDER_REFERENCE_REQUIRED');
  return value;
}
