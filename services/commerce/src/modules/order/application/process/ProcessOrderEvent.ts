import type { OrderEventProcess, OrderProcessEvent } from '../port/OrderEventProcess';

export class ProcessOrderEvent {
  constructor(private readonly events: OrderEventProcess) {}
  execute(event: OrderProcessEvent, signal: AbortSignal, deadline: number): Promise<void> {
    return this.events.process(event, signal, deadline);
  }
}
