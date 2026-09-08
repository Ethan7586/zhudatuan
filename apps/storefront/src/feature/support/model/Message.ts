import type { SupportAttachment } from './Attachment';
import type { OperationOutputFor } from '@shop/contract';

type MessageDto = OperationOutputFor<'support.messages.read'>['items'][number];

export interface SupportMessage {
  readonly id: string;
  readonly clientMessageId: string;
  readonly authorType: MessageDto['authorType'];
  readonly authorId: string;
  readonly kind: MessageDto['kind'];
  readonly visibility: MessageDto['visibility'];
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
  readonly context: SupportContext;
  readonly nextCursor?: string;
}

export interface SupportContext {
  readonly member: Readonly<{ id: string; displayName: string; employeeNo: string | null; mobileMasked: string | null }>;
  readonly organization: Readonly<{ id: string }>;
  readonly orders: readonly Readonly<{ id: string; number: string; state: string; totalMinor: number }>[];
  readonly benefits: readonly Readonly<{ id: string; state: string; kind: string; currency: string; remainingMinor: number; expiresAt: string | null }>[];
}

export interface MessageDraft {
  readonly caseId: string;
  readonly version: number;
  readonly message: string;
  readonly attachmentIds: readonly string[];
  readonly clientMessageId: string;
  readonly idempotencyKey: string;
}
