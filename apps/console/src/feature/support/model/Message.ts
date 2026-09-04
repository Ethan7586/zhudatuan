import type { OperationOutputFor } from '@shop/contract';
import type { DeepReadonly } from '../../../shared/model/Immutable';

type ConversationOutput = OperationOutputFor<'support.messages.read'>;
export type Message = DeepReadonly<ConversationOutput['items'][number]>;
export type Attachment = DeepReadonly<ConversationOutput['attachments'][number]>;

export type ConversationPage = DeepReadonly<ConversationOutput>;

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
  readonly state: Attachment['state'] | 'uploading' | 'failed';
  readonly error?: string;
}

export function mergeMessages(pages: readonly ConversationPage[]): readonly Message[] {
  const values = new Map<number, Message>();
  for (const page of [...pages].reverse()) for (const message of page.items) values.set(message.sequence, message);
  return Object.freeze([...values.values()].sort((left, right) => left.sequence - right.sequence || left.id.localeCompare(right.id)));
}
