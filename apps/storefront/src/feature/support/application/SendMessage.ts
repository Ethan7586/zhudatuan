import type { StorefrontSession } from '../../../entity/session';
import type { SupportPort } from '../public/SupportPort';
import type { MessageDraft } from '../model/Message';

export class SendMessage {
  constructor(private readonly gateway: Pick<SupportPort, 'createMessageDraft' | 'send'>) {}
  create(caseId: string, version: number, message: string, attachmentIds: readonly string[] = []): MessageDraft {
    const body = message.trim();
    if ((body.length === 0 && attachmentIds.length === 0) || body.length > 4000) throw new Error('请输入消息内容或添加附件，文字最多 4000 个字符');
    return this.gateway.createMessageDraft(caseId, version, body, attachmentIds);
  }
  execute(session: StorefrontSession, draft: MessageDraft) {
    return this.gateway.send(session, draft);
  }
}
