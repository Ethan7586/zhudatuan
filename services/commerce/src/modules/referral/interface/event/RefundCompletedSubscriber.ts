export class RefundCompletedSubscriber {
  receive(eventId: string, scopeId: string, payload: Readonly<Record<string, unknown>>): Readonly<{ eventId: string; eventType: 'refund.completed'; scopeId: string; orderId: string }> {
    return Object.freeze({ eventId, eventType: 'refund.completed', scopeId, orderId: reference(payload.order) });
  }
}

function reference(value: unknown): string {
  if (typeof value !== 'string' || !value) throw new Error('REFERRAL_ORDER_REFERENCE_REQUIRED');
  return value;
}
