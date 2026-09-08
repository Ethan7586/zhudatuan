import type { ObjectMetadata, UploadAuthorization } from '../../public/ObjectPort';

export type UploadCategory = 'import' | 'attachment' | 'evidence' | 'asset';
export interface UploadRequest {
  readonly tenant: string;
  readonly category: UploadCategory;
  readonly name: string;
  readonly contentType: string;
  readonly size: number;
  readonly sha256: string;
  readonly retentionDays: number;
}
export interface UploadRecord {
  readonly reference: string;
  readonly path: string;
  readonly sha256: string;
  readonly size: number;
  readonly contentType: string;
  readonly retentionUntil: string;
  readonly upload: UploadAuthorization;
}
export interface UploadPort {
  authorize(request: UploadRequest, now?: Date): Promise<UploadRecord>;
  verify(record: Omit<UploadRecord, 'upload'>): Promise<ObjectMetadata>;
}
