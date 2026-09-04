import { DomainError } from '../../../../foundation/domain/DomainError';
import type { MessageAuthor, MessageKind, MessageVisibility } from '../model/Message';

export interface MessageContent {
  readonly body: string;
  readonly clientMessageId: string;
  readonly attachmentIds: readonly string[];
  readonly author: MessageAuthor;
  readonly kind: MessageKind;
  readonly visibility: MessageVisibility;
}

export interface MessageEvidence {
  readonly id: string;
  readonly state: 'pending' | 'clean' | 'rejected';
}

export class MessagePolicy {
  prepare(input: Readonly<{ body: unknown; clientMessageId: unknown; attachmentIds: unknown; author: MessageAuthor; visibility?: unknown }>): MessageContent {
    if (input.body !== undefined && typeof input.body !== 'string') throw new DomainError('VALIDATION_FAILED', { field: 'message' });
    const body = typeof input.body === 'string' ? input.body.trim() : '';
    if (body.length > 4000) throw new DomainError('VALIDATION_FAILED', { field: 'message' });
    if (typeof input.clientMessageId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9:.-]{7,127}$/.test(input.clientMessageId)) throw new DomainError('VALIDATION_FAILED', { field: 'clientMessageId' });
    const attachments = input.attachmentIds === undefined ? [] : input.attachmentIds;
    if (!Array.isArray(attachments) || attachments.length > 10 || !attachments.every((value) => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9:.-]{1,159}$/.test(value))) {
      throw new DomainError('VALIDATION_FAILED', { field: 'attachmentIds' });
    }
    const attachmentIds = Object.freeze([...new Set(attachments)]);
    if (body.length === 0 && attachmentIds.length === 0) throw new DomainError('VALIDATION_FAILED', { field: 'message' });
    const visibility = input.visibility === undefined ? (input.author === 'system' ? 'internal' : 'external') : input.visibility;
    if (visibility !== 'external' && visibility !== 'internal') throw new DomainError('VALIDATION_FAILED', { field: 'visibility' });
    if ((input.author === 'member' && visibility !== 'external') || (input.author === 'system' && visibility !== 'internal')) throw new DomainError('SUPPORT_MESSAGE_VISIBILITY_DENIED');
    const kind: MessageKind = input.author === 'system' ? 'system' : attachmentIds.length > 0 ? 'attachment' : 'text';
    return Object.freeze({ body, clientMessageId: input.clientMessageId, attachmentIds, author: input.author, kind, visibility });
  }

  assertAttachments(ids: readonly string[], evidence: readonly MessageEvidence[]): void {
    if (evidence.length !== ids.length || evidence.some(({ id }) => !ids.includes(id))) throw new DomainError('SUPPORT_ATTACHMENT_NOT_READY');
    if (evidence.some(({ state }) => state === 'rejected')) throw new DomainError('SUPPORT_ATTACHMENT_REJECTED');
    if (evidence.some(({ state }) => state !== 'clean')) throw new DomainError('SUPPORT_ATTACHMENT_NOT_READY');
  }
}
