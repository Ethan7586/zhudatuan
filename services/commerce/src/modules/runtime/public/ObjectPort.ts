import { token } from '../../../composition/Container';

export interface StoredObject {
  readonly reference: string;
  readonly sha256: string;
  readonly size: number;
  readonly scan: 'clean';
}

export interface ObjectMetadata extends StoredObject {
  readonly contentType: string;
  readonly path: string;
  readonly retentionUntil: string | null;
  readonly lockedUntil: string | null;
}

export interface ObjectUpload {
  append(bytes: Uint8Array): Promise<void>;
  complete(): Promise<StoredObject>;
  abort(): Promise<void>;
}

export interface UploadAuthorization {
  readonly reference: string;
  readonly url: string;
  readonly method: 'PUT';
  readonly headers: Readonly<Record<string, string>>;
  readonly expiresAt: string;
}

export interface ObjectLock {
  readonly mode: 'compliance';
  readonly lockedUntil: string;
}

/** Runtime-owned object capability. Callers persist only opaque references. */
export interface ObjectStore {
  create(path: string, contentType: string): Promise<ObjectUpload>;
  find(path: string): Promise<ObjectMetadata | null>;
  chunks(reference: string, maximum: number): AsyncIterable<Uint8Array>;
  read(reference: string, maximum: number): Promise<Uint8Array>;
  inspect(reference: string): Promise<ObjectMetadata>;
  lock(reference: string, until: string): Promise<ObjectLock>;
  remove(reference: string): Promise<void>;
  authorize(reference: string, seconds: number): Promise<Readonly<{ url: string; expiresAt: string }>>;
  authorizeUpload(input: Readonly<{ path: string; contentType: string; size: number; sha256: string; expiresIn: number; retentionUntil: string }>): Promise<UploadAuthorization>;
}

export const OBJECT_STORE = token<ObjectStore>('object.store');
