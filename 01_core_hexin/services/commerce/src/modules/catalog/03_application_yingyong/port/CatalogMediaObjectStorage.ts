export type CatalogMediaPurpose = 'cover' | 'gallery' | 'detail';

export interface CatalogMediaTarget {
  readonly id: string;
  readonly provider: string;
  readonly endpoint: string;
  readonly region: string;
  readonly bucket: string;
  readonly publicBaseUrl: string;
  readonly required: boolean;
  readonly enabled: boolean;
}

export interface CatalogMediaObjectUpload {
  readonly objectKey: string;
  readonly bytes: Uint8Array;
  readonly contentType: string;
  readonly sha256: string;
}

export interface CatalogMediaStoredObject {
  readonly exists: boolean;
  readonly byteSize: number;
  readonly sha256: string | null;
}

export interface CatalogMediaObjectStorage {
  upload(input: CatalogMediaObjectUpload): Promise<void>;
  inspect(objectKey: string): Promise<CatalogMediaStoredObject>;
}

export type CatalogMediaStorageResolver = (
  target: CatalogMediaTarget,
) => CatalogMediaObjectStorage;
