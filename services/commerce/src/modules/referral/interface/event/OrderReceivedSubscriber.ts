export class OrderReceivedSubscriber {
  receive(eventId: string, scopeId: string, payload: Readonly<Record<string, unknown>>) {
    const order = reference(payload.orderId);
    return Object.freeze({ eventId, eventType: 'order.received' as const, scopeId, sourceId: order, resourceId: order });
  }
}

function reference(value: unknown): string {
  if (typeof value !== 'string' || !value) throw new Error('REFERRAL_ORDER_REFERENCE_REQUIRED');
  return value;
}
