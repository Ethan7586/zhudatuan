import type { OperationOutputFor } from '@shop/contract';
export type { SupportAttachmentType } from '@shop/contract';

type AttachmentDto = OperationOutputFor<'support.messages.read'>['attachments'][number];

export interface SupportAttachment {
  readonly id: string;
  readonly messageId: string | null;
  readonly name: string;
  readonly contentType: string;
  readonly size: number;
  readonly state: AttachmentDto['state'];
  readonly rejectionReason: string | null;
  readonly recoveryAction: string | null;
  readonly download: Readonly<{ url: string; expiresAt: string }> | null;
  readonly createdAt: string;
}

export interface PendingAttachment {
  readonly id: string;
  readonly name: string;
  readonly state: SupportAttachment['state'] | 'uploading' | 'failed';
  readonly error?: string;
}
