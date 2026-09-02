import type { OperationOutputFor } from '@shop/contract';

export type ConversationPage = OperationOutputFor<'support.messages.read'>;
export type Message = ConversationPage['items'][number];
export type Attachment = ConversationPage['attachments'][number];

export interface PendingMessage {
  readonly id: string;
  readonly clientMessageId: string;
  readonly body: string;
  readonly state: 'sending' | 'failed';
  readonly error?: string;
}
