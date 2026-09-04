export type ReferralEventType = 'order.paid' | 'order.received' | 'refund.completed' | 'approval.instance.approved';

export interface ReferralProcessEvent {
  readonly eventId: string;
  readonly eventType: ReferralEventType;
  readonly scopeId: string;
  readonly sourceId: string;
  readonly resourceId: string;
}

export interface ReferralEventProcess {
  process(event: ReferralProcessEvent, signal: AbortSignal, deadline: number): Promise<void>;
}
