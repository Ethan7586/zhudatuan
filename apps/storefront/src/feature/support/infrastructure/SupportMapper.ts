import type { SupportAttachment } from '../model/Attachment';
import type { Conversation, SupportMessage } from '../model/Message';
import type { SupportCase, SupportPage } from '../model/SupportCase';
import { nullableText } from '../../../shared/format/Text';
import type { OperationOutputFor } from '@shop/contract';

type CasesOutput = OperationOutputFor<'support.cases.read'>;
type ConversationOutput = OperationOutputFor<'support.messages.read'>;

export function mapCases(value: CasesOutput): SupportPage {
  return Object.freeze({
    items: Object.freeze(value.items.map(mapCase)),
    ...(value.nextCursor ? { nextCursor: value.nextCursor } : {}),
  });
}

export function mapConversation(value: ConversationOutput): Conversation {
  return Object.freeze({
    items: Object.freeze([...value.items].map(mapMessage).sort((left, right) => left.sequence - right.sequence || left.id.localeCompare(right.id))),
    attachments: Object.freeze(value.attachments.map(mapAttachment)),
    conversationVersion: value.conversationVersion,
    latestSequence: value.latestSequence,
    lastReadSequence: value.lastReadSequence,
    ...(value.nextCursor ? { nextCursor: value.nextCursor } : {}),
  });
}

function mapCase(value: CasesOutput['items'][number]): SupportCase {
  return Object.freeze({
    id: String(value.id),
    conversationId: String(value.conversation_id),
    subject: String(value.subject),
    priority: value.priority,
    state: value.state,
    orderId: nullableText(value.order_id),
    assignedAgentId: nullableText(value.assigned_agent_id),
    responseDueAt: String(value.response_due_at),
    resolutionDueAt: String(value.resolution_due_at),
    updatedAt: String(value.updated_at),
    version: Number(value.version),
    unreadCount: Number(value.unread_count),
    slaRisk: value.sla_risk,
  });
}

function mapMessage(value: ConversationOutput['items'][number]): SupportMessage {
  return Object.freeze({ id: value.id, clientMessageId: value.clientMessageId, authorType: value.authorType, authorId: value.authorId, kind: value.kind, visibility: value.visibility, body: value.body, sequence: value.sequence, version: value.version, createdAt: value.createdAt });
}

function mapAttachment(value: ConversationOutput['attachments'][number]): SupportAttachment {
  return Object.freeze({ id: value.id, messageId: value.messageId, name: value.name, contentType: value.contentType, size: value.sizeBytes, state: value.state, rejectionReason: value.rejectionReason, recoveryAction: value.recoveryAction, download: value.download ?? null, createdAt: value.createdAt });
}
