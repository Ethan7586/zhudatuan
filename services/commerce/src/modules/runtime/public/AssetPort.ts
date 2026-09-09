import { publicPort } from '../../../composition/ModuleRegistry';
import type { ObjectMetadata, UploadAuthorization } from './ObjectPort';

export interface AssetUploadRequest {
  readonly tenant: string;
  readonly name: string;
  readonly contentType: 'image/jpeg' | 'image/png';
  readonly size: number;
  readonly sha256: string;
}

export interface AssetUploadRecord {
  readonly reference: string;
  readonly path: string;
  readonly sha256: string;
  readonly size: number;
  readonly contentType: 'image/jpeg' | 'image/png';
  readonly retentionUntil: string;
  readonly upload: UploadAuthorization;
}

export interface AssetPort {
  authorize(request: AssetUploadRequest): Promise<AssetUploadRecord>;
  verify(record: Omit<AssetUploadRecord, 'upload'>): Promise<ObjectMetadata>;
  link(reference: string): Promise<Readonly<{ url: string; expiresAt: string }>>;
}

export const ASSET_PORT = publicPort<AssetPort>('runtime', 'asset');
