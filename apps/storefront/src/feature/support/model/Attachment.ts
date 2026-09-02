export type SupportAttachmentType = 'image/jpeg' | 'image/png' | 'application/pdf' | 'text/plain';

export interface SupportAttachment {
  readonly id: string;
  readonly messageId: string | null;
  readonly name: string;
  readonly contentType: string;
  readonly size: number;
  readonly state: 'pending' | 'clean' | 'rejected';
  readonly download: Readonly<{ url: string; expiresAt: string }> | null;
  readonly createdAt: string;
}

export interface PendingAttachment {
  readonly id: string;
  readonly name: string;
  readonly state: 'uploading' | 'pending' | 'clean' | 'rejected' | 'failed';
  readonly error?: string;
}
