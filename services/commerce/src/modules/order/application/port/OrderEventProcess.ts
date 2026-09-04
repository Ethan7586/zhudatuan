export type OrderEventType = 'payment.captured' | 'fulfillment.shipped' | 'refund.completed';

export interface OrderProcessEvent {
  readonly eventId: string;
  readonly eventType: OrderEventType;
  readonly scopeId: string;
  readonly sourceId: string;
  readonly orderId: string;
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface OrderEventProcess {
  process(event: OrderProcessEvent, signal: AbortSignal, deadline: number): Promise<void>;
}
