import type { StorefrontSession } from '../../../entity/session';
import type { PendingAttachment, SupportAttachmentType } from '../model/Attachment';
import type { Conversation, MessageDraft } from '../model/Message';
import type { SupportCase, SupportPage, SupportPriority, SupportState } from '../model/SupportCase';
import type { SupportEvent } from '../model/SupportEvent';

export interface SupportEventStream extends AsyncIterable<SupportEvent> {
  close(): void;
}
export interface SentMessageReceipt {
  readonly ticket: Readonly<{ state: SupportState; version: number }>;
}

export interface SupportPort {
  cases(session: StorefrontSession, cursor?: string, signal?: AbortSignal): Promise<SupportPage>;
  case(session: StorefrontSession, id: string, signal?: AbortSignal): Promise<SupportCase | null>;
  create(session: StorefrontSession, subject: string, message: string, priority: SupportPriority, order: string | undefined, idempotencyKey: string): Promise<string>;
  conversation(session: StorefrontSession, id: string, cursor?: string, signal?: AbortSignal): Promise<Conversation>;
  send(session: StorefrontSession, draft: MessageDraft): Promise<SentMessageReceipt>;
  upload(session: StorefrontSession, id: string, input: Readonly<{ name: string; contentType: SupportAttachmentType; sizeBytes: number; sha256: string }>, file: File): Promise<PendingAttachment>;
  readstate(session: StorefrontSession, conversation: string, sequence: number): Promise<unknown>;
  events(session: StorefrontSession, conversationId: string, signal?: AbortSignal, lastEventId?: string): SupportEventStream;
  createMessageDraft(caseId: string, version: number, message: string, attachmentIds: readonly string[]): MessageDraft;
}
