import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { SupportPort } from '../public';

export class ReadConversation {
  constructor(private readonly gateway: SupportPort) {}
  execute(context: ConsoleContext, ticket: string, cursor?: string, signal?: AbortSignal) { return this.gateway.conversation(context, ticket, cursor, signal); }
}
