import type { PendingAttachment } from '../model/Attachment';

export interface ConversationDraftState {
  readonly message: string;
  readonly attachments: readonly PendingAttachment[];
}

export class ConversationDraftStore {
  private readonly values = new Map<string, ConversationDraftState>();

  read(caseId: string): ConversationDraftState {
    return this.values.get(caseId) ?? Object.freeze({ message: '', attachments: Object.freeze([]) });
  }

  write(caseId: string, value: ConversationDraftState): void {
    if (!value.message.trim() && value.attachments.length === 0) this.values.delete(caseId);
    else this.values.set(caseId, Object.freeze({ message: value.message, attachments: Object.freeze([...value.attachments]) }));
  }

  clear(caseId: string): void {
    this.values.delete(caseId);
  }
  hasUnsent(): boolean {
    return [...this.values.values()].some((value) => value.message.trim() || value.attachments.length > 0);
  }
}

export const conversationDrafts = new ConversationDraftStore();
