export type SupportAttachmentType = 'image/jpeg' | 'image/png' | 'application/pdf' | 'text/plain';

export interface SupportAttachment {
  readonly id: string;
  readonly reference: string;
  readonly sha256: string;
  readonly contentType: string;
  readonly size: number;
  readonly createdAt: string;
}

export interface SupportUpload {
  readonly name: string;
  readonly data: string;
  readonly contentType: SupportAttachmentType;
}
