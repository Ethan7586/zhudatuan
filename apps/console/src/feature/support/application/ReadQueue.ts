import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { TicketFilter } from '../model/TicketFilter';
import type { SupportPort } from '../public';

export class ReadQueue {
  constructor(private readonly gateway: SupportPort) {}
  execute(context: ConsoleContext, filter: TicketFilter, signal?: AbortSignal) {
    return this.gateway.queue(context, filter, signal);
  }
}
