import type { StorefrontSession } from '../../../shared/api/Session';
import { SupportGateway } from '../infrastructure/SupportGateway';
import type { Conversation } from '../model/Message';

export function readConversation(session: StorefrontSession, caseId: string, signal?: AbortSignal): Promise<Conversation> {
  return SupportGateway.conversation(session, caseId, signal);
}
