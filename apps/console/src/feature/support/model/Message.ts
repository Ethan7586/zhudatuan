export interface Message {
  readonly id: string;
  readonly clientMessageId: string;
  readonly conversationId: string;
  readonly authorType: 'member' | 'agent';
  readonly authorId: string;
  readonly body: string;
  readonly sequence: number;
  readonly version: number;
  readonly createdAt: string;
}

export interface Attachment {
  readonly id: string;
  readonly messageId: string | null;
  readonly name: string;
  readonly contentType: string;
  readonly sizeBytes: number;
  readonly state: 'pending' | 'clean' | 'rejected';
  readonly download?: Readonly<{ url: string; expiresAt: string }>;
  readonly createdAt: string;
}

export interface ConversationPage {
  readonly items: readonly Message[];
  readonly attachments: readonly Attachment[];
  readonly context: import('./SupportContext').SupportContext;
  readonly count: number;
  readonly nextCursor?: string;
  readonly conversationVersion: number;
  readonly latestSequence: number;
  readonly lastReadSequence: number;
}

export interface MessageDraft {
  readonly ticketId: string;
  readonly message: string;
  readonly attachmentIds: readonly string[];
  readonly clientMessageId: string;
  readonly idempotencyKey: string;
}

export interface UploadedAttachment {
  readonly id: string;
  readonly name: string;
  readonly state: 'uploading' | 'pending' | 'clean' | 'rejected' | 'failed';
  readonly error?: string;
}

export function mergeMessages(pages: readonly ConversationPage[]): readonly Message[] {
  const values = new Map<number, Message>();
  for (const page of [...pages].reverse()) for (const message of page.items) values.set(message.sequence, message);
  return Object.freeze([...values.values()].sort((left, right) => left.sequence - right.sequence || left.id.localeCompare(right.id)));
}
