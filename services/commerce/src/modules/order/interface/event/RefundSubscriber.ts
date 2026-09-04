import type { OrderProcessEvent } from '../../application/port/OrderEventProcess';
import { event } from './PaymentSubscriber';

export class RefundSubscriber {
  receive(eventId: string, scopeId: string, payload: Readonly<Record<string, unknown>>): OrderProcessEvent {
    return event('refund.completed', eventId, scopeId, payload);
  }
}
