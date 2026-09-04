import type { OrderProcessEvent } from '../../application/port/OrderEventProcess';
import { event } from './PaymentSubscriber';

export class FulfillmentSubscriber {
  receive(eventId: string, scopeId: string, payload: Readonly<Record<string, unknown>>): OrderProcessEvent {
    return event('fulfillment.shipped', eventId, scopeId, payload);
  }
}
