import type { StorefrontSession } from '../../../shared/api/Session';
import { createIdempotencyKey } from '@shop/sdk';
import { supportGateway, type SupportGateway } from '../infrastructure/SupportGateway';
import type { MessageDraft } from '../model/Message';

export class SendMessage {
  constructor(private readonly gateway: SupportGateway = supportGateway) {}
  create(caseId: string, version: number, message: string, attachmentIds: readonly string[] = []): MessageDraft {
    const body = message.trim();
    if (body.length < 1 || body.length > 4000) throw new Error('消息内容须为 1–4000 个字符');
    return Object.freeze({ caseId, version, message: body, attachmentIds: Object.freeze([...attachmentIds]), clientMessageId: crypto.randomUUID(), idempotencyKey: createIdempotencyKey() });
  }
  execute(session: StorefrontSession, draft: MessageDraft) {
    return this.gateway.send(session, draft);
  }
}
