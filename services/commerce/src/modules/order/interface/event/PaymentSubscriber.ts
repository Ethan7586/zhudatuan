import type { OrderProcessEvent } from '../../application/port/OrderEventProcess';

export class PaymentSubscriber {
  receive(eventId: string, scopeId: string, payload: Readonly<Record<string, unknown>>): OrderProcessEvent {
    return event('payment.captured', eventId, scopeId, payload);
  }
}

export function event(type: OrderProcessEvent['eventType'], eventId: string, scopeId: string,
  payload: Readonly<Record<string, unknown>>): OrderProcessEvent {
  const order = typeof payload.order === 'string' ? payload.order : typeof payload.orderId === 'string' ? payload.orderId : '';
  const sourceKey = type === 'payment.captured' ? 'payment' : type === 'refund.completed' ? 'refund' : 'fulfillment';
  const source = typeof payload[sourceKey] === 'string' ? payload[sourceKey] : '';
  if (!eventId || !scopeId || !order || !source) throw new Error('ORDER_EVENT_INVALID');
  return Object.freeze({ eventId, eventType: type, scopeId, sourceId: source, orderId: order, payload: Object.freeze({ ...payload }) });
}
