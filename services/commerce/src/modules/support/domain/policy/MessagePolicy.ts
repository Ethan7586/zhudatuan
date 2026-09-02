import { DomainError } from '../../../../foundation/domain/DomainError';

export class MessagePolicy {
  prepare(input: Readonly<{ body: unknown; clientMessageId: unknown; attachmentIds: unknown }>): Readonly<{ body: string; clientMessageId: string; attachmentIds: readonly string[] }> {
    if (typeof input.body !== 'string') throw new DomainError('VALIDATION_FAILED', { field: 'message' });
    const body = input.body.trim();
    if (body.length < 1 || body.length > 4000) throw new DomainError('VALIDATION_FAILED', { field: 'message' });
    if (typeof input.clientMessageId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9:.-]{7,127}$/.test(input.clientMessageId)) throw new DomainError('VALIDATION_FAILED', { field: 'clientMessageId' });
    const attachments = input.attachmentIds === undefined ? [] : input.attachmentIds;
    if (!Array.isArray(attachments) || attachments.length > 10 || !attachments.every((value) => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9:.-]{1,159}$/.test(value))) {
      throw new DomainError('VALIDATION_FAILED', { field: 'attachmentIds' });
    }
    return Object.freeze({ body, clientMessageId: input.clientMessageId, attachmentIds: Object.freeze([...new Set(attachments)]) });
  }
}
