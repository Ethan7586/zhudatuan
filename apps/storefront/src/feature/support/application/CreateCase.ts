import type { StorefrontSession } from '../../../entity/session';
import type { SupportGateway } from '../infrastructure/SupportGateway';
import type { SupportPriority } from '../model/SupportCase';

export class CreateCase {
  constructor(private readonly gateway: SupportGateway) {}
  execute(session: StorefrontSession, subject: string, message: string, priority: SupportPriority, order?: string): Promise<string> {
    if (!subject.trim() || !message.trim()) throw new Error('请填写问题标题和详细描述');
    return this.gateway.create(session, subject.trim(), message.trim(), priority, order, crypto.randomUUID());
  }
}
