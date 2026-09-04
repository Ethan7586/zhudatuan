export type FulfillmentEventType = 'order.paid' | 'aftersale.changed' | 'channel.webhook.applied' | 'verification.completed';

export interface FulfillmentProcessEvent {
  readonly eventId: string;
  readonly eventType: FulfillmentEventType;
  readonly scopeId: string;
  readonly sourceId: string;
  readonly resourceId: string;
  readonly paymentId?: string;
  readonly kind?: string;
  readonly subjectType?: string;
}

export interface FulfillmentEventProcess {
  process(event: FulfillmentProcessEvent, signal: AbortSignal, deadline: number): Promise<void>;
}
