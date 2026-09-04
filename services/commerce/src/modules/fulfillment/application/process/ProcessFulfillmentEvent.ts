import type { FulfillmentEventProcess, FulfillmentProcessEvent } from '../port/FulfillmentEventProcess';

export class ProcessFulfillmentEvent {
  constructor(private readonly events: FulfillmentEventProcess) {}

  execute(event: FulfillmentProcessEvent, signal: AbortSignal, deadline: number): Promise<void> {
    return this.events.process(event, signal, deadline);
  }
}
