import type { OperationOutputFor } from '@shop/contract';
import type { StorefrontClient } from '../../../shared/api/Client';
import type { StorefrontSession } from '../../../entity/session';
import type { SupportAttachmentType } from '../model/Attachment';
import type { MessageDraft } from '../model/Message';
import type { SupportPriority } from '../model/SupportCase';
import { mapCases, mapConversation } from './SupportMapper';

export class SupportGateway {
  constructor(private readonly support: StorefrontClient['commerce']['support'], private readonly context: StorefrontClient['context']) {}
  async cases(session: StorefrontSession, cursor?: string, signal?: AbortSignal) {
    const value = await this.support.casesRead({ query: { limit: 50, ...(cursor ? { cursor } : {}) } }, this.context(session, { signal }));
    return mapCases(value);
  }

  async case(session: StorefrontSession, id: string, signal?: AbortSignal) {
    const value = await this.support.casesRead({ query: { limit: 1, keyword: id } }, this.context(session, { signal }));
    return mapCases(value).items.find((item) => item.id === id) ?? null;
  }

  async create(session: StorefrontSession, subject: string, message: string, priority: SupportPriority, order: string | undefined, idempotencyKey: string): Promise<string> {
    const value = await this.support.casesCreate({ body: { subject, message, priority, channel: 'inapp', ...(order ? { order } : {}) } }, this.context(session, { write: true, idempotencyKey }));
    return value.id;
  }

  async conversation(session: StorefrontSession, id: string, cursor?: string, signal?: AbortSignal) {
    const value = await this.support.messagesRead({ path: { caseid: id }, query: { limit: 100, ...(cursor ? { cursor } : {}) } }, this.context(session, { signal }));
    return mapConversation(value);
  }

  send(session: StorefrontSession, draft: MessageDraft) {
    return this.support.messagesSend(
      { path: { caseid: draft.caseId }, body: { message: draft.message, clientMessageId: draft.clientMessageId, ...(draft.attachmentIds.length ? { attachmentIds: [...draft.attachmentIds] } : {}) } },
      this.context(session, { write: true, idempotencyKey: draft.idempotencyKey, expectedVersion: draft.version })
    );
  }

  attachment(session: StorefrontSession, id: string, input: Readonly<{ name: string; contentType: SupportAttachmentType; sizeBytes: number; sha256: string }>, idempotencyKey: string) {
    return this.support.attachmentsCreate({ path: { caseid: id }, body: input }, this.context(session, { write: true, idempotencyKey }));
  }

  readstate(session: StorefrontSession, conversation: string, sequence: number, idempotencyKey: string) {
    return this.support.readstatesManage({ path: { conversationid: conversation }, body: { lastSequence: sequence } }, this.context(session, { write: true, idempotencyKey }));
  }

  events(session: StorefrontSession, conversationId: string, signal?: AbortSignal, lastEventId?: string) {
    return this.support.eventsRead({ query: { conversationId } }, this.context(session, { signal, lastEventId }));
  }
}

export type SupportEvent = OperationOutputFor<'support.events.read'>;
