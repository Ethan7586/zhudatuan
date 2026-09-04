import { OP_SUPPORT_MESSAGES_SEND } from '@shop/contract/ids';
import { PERM_SUPPORT_MESSAGE_SEND } from '@shop/authz/ids';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { MessageDraft } from '../model/Message';
import type { Ticket } from '../model/Ticket';
import type { SupportPort } from '../public';

export class SendMessage {
  constructor(private readonly gateway: SupportPort) {}

  create(ticketId: string, message: string, attachmentIds: readonly string[] = []): MessageDraft {
    return this.gateway.createMessageDraft(ticketId, message, attachmentIds);
  }

  execute(context: ConsoleContext, ticket: Ticket, draft: MessageDraft) {
    if (!canSendMessage(context, ticket)) throw new Error(ticket.state === 'closed' ? '工单已关闭，请先重新打开。' : '当前账号没有客服消息发送权限。');
    const message = draft.message.trim();
    if ((message.length === 0 && draft.attachmentIds.length === 0) || message.length > 4000) throw new Error('请输入回复内容或添加附件，文字最多 4000 个字符。');
    return this.gateway.send(context, ticket, Object.freeze({ ...draft, message }));
  }
}

export function canSendMessage(context: ConsoleContext, ticket: Ticket): boolean {
  return ticket.state !== 'closed' && context.session.csrf !== undefined && context.session.permissions.includes(PERM_SUPPORT_MESSAGE_SEND) && context.session.capabilities.includes(OP_SUPPORT_MESSAGES_SEND);
}
