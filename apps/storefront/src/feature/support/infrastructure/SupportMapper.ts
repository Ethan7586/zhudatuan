import type { SupportAttachment } from '../model/Attachment';
import type { Conversation, SupportMessage } from '../model/Message';
import type { SupportCase, SupportPage } from '../model/SupportCase';
import { nullableText } from '../../../shared/format/Text';

type RecordValue = Readonly<Record<string, unknown>>;

export function mapCases(value: Readonly<{ items: readonly RecordValue[]; nextCursor?: string }>): SupportPage {
  return Object.freeze({
    items: Object.freeze(value.items.map(mapCase)),
    ...(value.nextCursor ? { nextCursor: value.nextCursor } : {}),
  });
}

export function mapConversation(value: Readonly<{ items: readonly RecordValue[]; attachments: readonly RecordValue[]; nextCursor?: string }>): Conversation {
  return Object.freeze({
    items: Object.freeze(value.items.map(mapMessage)),
    attachments: Object.freeze(value.attachments.map(mapAttachment)),
    ...(value.nextCursor ? { nextCursor: value.nextCursor } : {}),
  });
}

function mapCase(value: RecordValue): SupportCase {
  return Object.freeze({
    id: String(value.id),
    conversationId: String(value.conversation_id),
    subject: String(value.subject),
    priority: value.priority as SupportCase['priority'],
    state: value.state as SupportCase['state'],
    orderId: nullableText(value.order_id),
    assignedAgentId: nullableText(value.assigned_agent_id),
    responseDueAt: String(value.response_due_at),
    resolutionDueAt: String(value.resolution_due_at),
    updatedAt: String(value.updated_at),
    version: Number(value.version),
  });
}

function mapMessage(value: RecordValue): SupportMessage {
  return Object.freeze({ id: String(value.id), authorType: value.authorType as SupportMessage['authorType'], author: nullableText(value.author), body: String(value.body), createdAt: String(value.createdAt) });
}

function mapAttachment(value: RecordValue): SupportAttachment {
  return Object.freeze({ id: String(value.id), reference: String(value.object_ref), sha256: String(value.sha256), contentType: String(value.kind), size: Number(value.size_bytes), createdAt: String(value.created_at) });
}
