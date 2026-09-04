import type { ReferralEventProcess, ReferralProcessEvent } from '../port/ReferralEventProcess';

export class ProcessReferralEvent {
  constructor(private readonly events: ReferralEventProcess) {}

  execute(event: ReferralProcessEvent, signal: AbortSignal, deadline: number): Promise<void> {
    return this.events.process(event, signal, deadline);
  }
}
