export interface ReferralOrderEvent {
  readonly eventId: string;
  readonly eventType: 'order.paid' | 'order.received' | 'refund.completed';
  readonly scopeId: string;
  readonly orderId: string;
}

export interface ReferralEventProcess {
  process(event: ReferralOrderEvent, signal: AbortSignal, deadline: number): Promise<void>;
}
