import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { SupportGateway } from '../infrastructure/SupportGateway';
import { filterSignature, type TicketFilter } from '../model/TicketFilter';

export const queueKey = (context: ConsoleContext, filter: TicketFilter) => Object.freeze(['console', context.scope.kind, context.scope.id, context.session.accessVersion, 'support.queue', filterSignature(filter)] as const);
export class ReadQueue {
  constructor(private readonly gateway: SupportGateway) {}
  execute(context: ConsoleContext, filter: TicketFilter, signal?: AbortSignal) { return this.gateway.queue(context, filter, signal); }
}
