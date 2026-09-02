import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { SupportGateway } from '../infrastructure/SupportGateway';

export const conversationKey = (context: ConsoleContext, ticket: string) => Object.freeze(['console', context.scope.kind, context.scope.id, context.session.accessVersion, 'support.conversation', ticket] as const);
export class ReadConversation {
  constructor(private readonly gateway: SupportGateway) {}
  execute(context: ConsoleContext, ticket: string, cursor?: string, signal?: AbortSignal) { return this.gateway.conversation(context, ticket, cursor, signal); }
}
