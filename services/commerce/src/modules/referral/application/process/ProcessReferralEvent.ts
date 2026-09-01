import type { ReferralEventProcess, ReferralOrderEvent } from '../port/ReferralEventProcess';

export class ProcessReferralEvent {
  constructor(private readonly events: ReferralEventProcess) {}

  execute(event: ReferralOrderEvent, signal: AbortSignal, deadline: number): Promise<void> {
    return this.events.process(event, signal, deadline);
  }
}
