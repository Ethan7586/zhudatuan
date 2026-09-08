import type { SupportAttachment } from './Attachment';
import type { Conversation, SupportMessage } from './Message';

export function mergeConversations(pages: readonly Conversation[]): Conversation {
  const messages = new Map<number, SupportMessage>();
  const attachments = new Map<string, SupportAttachment>();
  for (const page of [...pages].reverse()) {
    for (const message of page.items) messages.set(message.sequence, message);
    for (const attachment of page.attachments) attachments.set(attachment.id, attachment);
  }
  const latest = pages[0];
  return Object.freeze({
    items: Object.freeze([...messages.values()].sort((left, right) => left.sequence - right.sequence || left.id.localeCompare(right.id))),
    attachments: Object.freeze([...attachments.values()]),
    conversationVersion: latest?.conversationVersion ?? 0,
    latestSequence: latest?.latestSequence ?? 0,
    lastReadSequence: latest?.lastReadSequence ?? 0,
    context: latest?.context ?? emptyContext(),
    ...(pages.at(-1)?.nextCursor ? { nextCursor: pages.at(-1)!.nextCursor } : {}),
  });
}

function emptyContext(): Conversation['context'] {
  return Object.freeze({ member: Object.freeze({ id: '', displayName: '', employeeNo: null, mobileMasked: null }), organization: Object.freeze({ id: '' }), orders: Object.freeze([]), benefits: Object.freeze([]) });
}
