export interface PaymentCancellationEvent {
  readonly eventId: string;
  readonly scopeId: string;
  readonly orderId: string;
  readonly reason: string;
}

export interface PaymentCancellationProcess {
  process(event: PaymentCancellationEvent, signal: AbortSignal, deadline: number): Promise<void>;
}
