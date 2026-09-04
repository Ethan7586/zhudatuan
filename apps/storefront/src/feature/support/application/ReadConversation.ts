import type { StorefrontSession } from '../../../entity/session';
import type { SupportPort } from '../public/SupportPort';
import type { Conversation } from '../model/Message';

export class ReadConversation {
  constructor(private readonly gateway: Pick<SupportPort, 'conversation'>) {}
  execute(session: StorefrontSession, caseId: string, cursor?: string, signal?: AbortSignal): Promise<Conversation> {
    return this.gateway.conversation(session, caseId, cursor, signal);
  }
}
