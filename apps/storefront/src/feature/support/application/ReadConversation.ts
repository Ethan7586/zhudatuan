import type { StorefrontSession } from '../../../entity/session';
import type { SupportGateway } from '../infrastructure/SupportGateway';
import type { Conversation } from '../model/Message';

export class ReadConversation {
  constructor(private readonly gateway: SupportGateway) {}
  execute(session: StorefrontSession, caseId: string, cursor?: string, signal?: AbortSignal): Promise<Conversation> {
    return this.gateway.conversation(session, caseId, cursor, signal);
  }
}
