import { createIdempotencyKey } from '@shop/sdk/context';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { SupportGateway } from '../infrastructure/SupportGateway';
import type { Ticket } from '../model/Ticket';

export interface MessageDraft {
  readonly ticketId: string;
  readonly message: string;
  readonly attachmentIds: readonly string[];
  readonly clientMessageId: string;
  readonly idempotencyKey: string;
}

export class SendMessage {
  constructor(private readonly gateway: SupportGateway) {}
  create(ticketId: string, message: string, attachmentIds: readonly string[] = []): MessageDraft {
    return Object.freeze({ ticketId, message, attachmentIds: Object.freeze([...attachmentIds]), clientMessageId: crypto.randomUUID(), idempotencyKey: createIdempotencyKey() });
  }
  execute(context: ConsoleContext, ticket: Ticket, draft: MessageDraft) {
    if (!canSendMessage(context, ticket)) throw new Error(ticket.state === 'closed' ? '工单已关闭，请先重新打开。' : '当前账号没有客服消息发送权限。');
    const message = draft.message.trim();
    if (message.length === 0 || message.length > 4000) throw new Error('回复内容须为 1–4000 个字符。');
    return this.gateway.send(context, { ticket: ticket.id, version: ticket.version, message, attachmentIds: draft.attachmentIds, clientMessageId: draft.clientMessageId, idempotencyKey: draft.idempotencyKey });
  }
}

export function canSendMessage(context: ConsoleContext, ticket: Ticket): boolean {
  return ticket.state !== 'closed' && context.session.csrf !== undefined && context.session.permissions.includes('support.message.send') && context.session.capabilities.includes('support.messages.send');
}
