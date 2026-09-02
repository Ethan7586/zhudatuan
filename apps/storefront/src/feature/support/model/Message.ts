import type { SupportAttachment } from './Attachment';

export interface SupportMessage {
  readonly id: string;
  readonly clientMessageId: string;
  readonly authorType: 'member' | 'agent';
  readonly authorId: string;
  readonly body: string;
  readonly sequence: number;
  readonly version: number;
  readonly createdAt: string;
}

export interface Conversation {
  readonly items: readonly SupportMessage[];
  readonly attachments: readonly SupportAttachment[];
  readonly conversationVersion: number;
  readonly latestSequence: number;
  readonly lastReadSequence: number;
  readonly nextCursor?: string;
}

export interface MessageDraft {
  readonly caseId: string;
  readonly version: number;
  readonly message: string;
  readonly attachmentIds: readonly string[];
  readonly clientMessageId: string;
  readonly idempotencyKey: string;
}
