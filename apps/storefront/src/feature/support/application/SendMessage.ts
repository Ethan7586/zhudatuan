import type { StorefrontSession } from '../../../shared/api/Session';
import { SupportGateway } from '../infrastructure/SupportGateway';

export class SendMessage {
  execute(session: StorefrontSession, caseId: string, message: string): Promise<void> {
    if (!message.trim()) throw new Error('请输入消息内容');
    return SupportGateway.send(session, caseId, message.trim(), crypto.randomUUID());
  }
}
