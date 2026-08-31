export interface SupportMessage {
  readonly id: string;
  readonly authorType: 'member' | 'agent' | 'system';
  readonly author: string | null;
  readonly body: string;
  readonly createdAt: string;
}

export interface Conversation {
  readonly items: readonly SupportMessage[];
  readonly attachments: readonly SupportAttachment[];
  readonly nextCursor?: string;
}

import type { SupportAttachment } from './Attachment';
