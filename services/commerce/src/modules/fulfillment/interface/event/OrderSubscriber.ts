import type { FulfillmentProcessEvent } from '../../application/port/FulfillmentEventProcess';

export class OrderSubscriber {
  receive(eventId: string, scopeId: string, payload: Readonly<Record<string, unknown>>): FulfillmentProcessEvent {
    const order = text(payload.order, 'FULFILLMENT_ORDER_REQUIRED');
    return Object.freeze({
      eventId: text(eventId, 'FULFILLMENT_EVENT_REQUIRED'),
      eventType: 'order.paid' as const,
      scopeId: text(scopeId, 'FULFILLMENT_SCOPE_REQUIRED'),
      sourceId: order,
      resourceId: order,
      paymentId: text(payload.payment, 'FULFILLMENT_PAYMENT_REQUIRED'),
    });
  }

  return(eventId: string, scopeId: string, sourceId: string, payload: Readonly<Record<string, unknown>>): FulfillmentProcessEvent {
    const aftersale = text(payload.aftersale, 'FULFILLMENT_AFTERSALE_REQUIRED');
    if (aftersale !== sourceId) throw new Error('FULFILLMENT_AFTERSALE_CONTEXT_MISMATCH');
    return Object.freeze({
      eventId: text(eventId, 'FULFILLMENT_EVENT_REQUIRED'),
      eventType: 'aftersale.changed' as const,
      scopeId: text(scopeId, 'FULFILLMENT_SCOPE_REQUIRED'),
      sourceId: aftersale,
      resourceId: aftersale,
      kind: text(payload.state, 'FULFILLMENT_AFTERSALE_STATE_REQUIRED'),
    });
  }
}

function text(value: unknown, code: string): string {
  if (typeof value !== 'string' || !value) throw new Error(code);
  return value;
}
