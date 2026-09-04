import type { PaymentCancellationEvent, PaymentCancellationProcess } from '../port/PaymentCancellationProcess';

export class CancelPayment {
  constructor(private readonly process: PaymentCancellationProcess) {}

  execute(event: PaymentCancellationEvent, signal: AbortSignal, deadline: number): Promise<void> {
    return this.process.process(event, signal, deadline);
  }
}
