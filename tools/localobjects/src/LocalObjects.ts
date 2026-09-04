import { createHash, createHmac, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { IMPORT_CAPACITY, RUNTIME_LIMITS } from '@shop/config/runtime';
import { LocalHttpError, equalSecret } from '../../localinfra/src/Http';

const OBJECT_PATH = /^[a-z0-9][a-z0-9/.-]{2,255}$/;
const CONTENT_TYPE = /^[a-z]+\/[a-z0-9.+-]+$/;
const REFERENCE = /^local:object:[a-f0-9-]{36}$/;
const UPLOAD_ID = /^[a-f0-9-]{36}$/;
const EICAR = Buffer.from('EICAR-STANDARD-ANTIVIRUS-TEST-FILE');

export interface ObjectMetadata {
  readonly contentType: string;
  readonly path: string;
  readonly reference: string;
  readonly scan: 'clean';
  readonly sha256: string;
  readonly size: number;
  readonly retentionUntil: string | null;
  readonly lockedUntil: string | null;
}

interface UploadState {
  readonly contentType: string;
  readonly id: string;
  readonly parts: Uint8Array[];
  readonly path: string;
  readonly reference: string;
  readonly expectedHash: string | null;
  readonly expectedSize: number | null;
  readonly expiresAt: number | null;
  readonly retentionUntil: string | null;
  size: number;
}

export class LocalObjects {
  private readonly uploads = new Map<string, UploadState>();

  constructor(
    private readonly directory: string,
    private readonly token: string,
    private readonly publicEndpoint: string
  ) {
    if (token.length < 16 || !publicEndpoint.startsWith('https://')) throw new Error('LOCAL_OBJECTS_CONFIGURATION_INVALID');
  }

  async initialize(): Promise<void> {
    await Promise.all(['objects', 'metadata', 'paths', 'temporary'].map((name) => mkdir(join(this.directory, name), { recursive: true })));
  }

  authorizeHeader(header: string | undefined): void {
    if (!header?.startsWith('Bearer ') || !equalSecret(header.slice(7), this.token)) throw new LocalHttpError(401, 'OBJECT_AUTHORIZATION_REQUIRED');
  }

  create(path: unknown, contentType: unknown): string {
    if (typeof path !== 'string' || !OBJECT_PATH.test(path) || typeof contentType !== 'string' || !CONTENT_TYPE.test(contentType)) {
      throw new LocalHttpError(400, 'OBJECT_UPLOAD_METADATA_INVALID');
    }
    const id = randomUUID();
    this.uploads.set(id, { contentType, id, parts: [], path, reference: `local:object:${randomUUID()}`, expectedHash: null,
      expectedSize: null, expiresAt: null, retentionUntil: null, size: 0 });
    return id;
  }

  append(id: string, sequence: number, bytes: Uint8Array): void {
    const upload = this.upload(id);
    if (sequence !== upload.parts.length || bytes.byteLength === 0 || bytes.byteLength > RUNTIME_LIMITS.upload.maximumChunkBytes ||
      upload.size + bytes.byteLength > IMPORT_CAPACITY.maximumFileBytes) {
      throw new LocalHttpError(400, 'OBJECT_UPLOAD_CHUNK_INVALID');
    }
    upload.parts.push(bytes.slice());
    upload.size += bytes.byteLength;
  }

  abort(id: string): void {
    if (!UPLOAD_ID.test(id)) throw new LocalHttpError(404, 'OBJECT_UPLOAD_NOT_FOUND');
    this.uploads.delete(id);
  }

  async complete(id: string, parts: unknown, expectedHash: unknown, expectedSize: unknown): Promise<ObjectMetadata> {
    const upload = this.upload(id);
    if (!Number.isSafeInteger(parts) || parts !== upload.parts.length || parts === 0 || !Number.isSafeInteger(expectedSize) || expectedSize !== upload.size || typeof expectedHash !== 'string' || !/^[a-f0-9]{64}$/.test(expectedHash)) {
      this.uploads.delete(id);
      throw new LocalHttpError(400, 'OBJECT_UPLOAD_INTEGRITY_INVALID');
    }
    const bytes = Buffer.concat(upload.parts.map((part) => Buffer.from(part)));
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    if (sha256 !== expectedHash || (upload.expectedHash !== null && upload.expectedHash !== sha256) ||
      (upload.expectedSize !== null && upload.expectedSize !== upload.size)) {
      this.uploads.delete(id);
      throw new LocalHttpError(400, 'OBJECT_UPLOAD_INTEGRITY_INVALID');
    }
    if (malware(bytes)) {
      this.uploads.delete(id);
      throw new LocalHttpError(422, 'OBJECT_MALWARE_DETECTED');
    }
    const metadata: ObjectMetadata = Object.freeze({
      contentType: upload.contentType,
      path: upload.path,
      reference: upload.reference,
      scan: 'clean',
      sha256,
      size: upload.size,
      retentionUntil: upload.retentionUntil,
      lockedUntil: null,
    });
    const temporary = join(this.directory, 'temporary', `${id}.object`);
    await writeFile(temporary, bytes, { mode: 0o600 });
    const object = this.objectFile(upload.reference);
    await rename(temporary, object);
    await this.writeMetadata(metadata);
    await writeFile(this.pathFile(upload.path), upload.reference, { mode: 0o600 });
    this.uploads.delete(id);
    return metadata;
  }

  async find(path: string): Promise<ObjectMetadata | undefined> {
    if (!OBJECT_PATH.test(path)) throw new LocalHttpError(400, 'OBJECT_PATH_INVALID');
    try {
      return await this.inspect((await readFile(this.pathFile(path), 'utf8')).trim());
    } catch (cause) {
      if (isMissing(cause)) return undefined;
      throw cause;
    }
  }

  async inspect(reference: string): Promise<ObjectMetadata> {
    const id = this.objectId(reference);
    try {
      const value: unknown = JSON.parse(await readFile(this.metadataFile(id), 'utf8'));
      if (!validMetadata(value) || value.reference !== reference) throw new Error('LOCAL_OBJECT_METADATA_CORRUPT');
      return Object.freeze(value);
    } catch (cause) {
      if (isMissing(cause)) throw new LocalHttpError(404, 'OBJECT_NOT_FOUND');
      throw cause;
    }
  }

  async read(reference: string): Promise<Readonly<{ bytes: Uint8Array; metadata: ObjectMetadata }>> {
    const metadata = await this.inspect(reference);
    const bytes = new Uint8Array(await readFile(this.objectFile(reference)));
    if (bytes.byteLength !== metadata.size || createHash('sha256').update(bytes).digest('hex') !== metadata.sha256) {
      throw new Error('LOCAL_OBJECT_CONTENT_CORRUPT');
    }
    return Object.freeze({ bytes, metadata });
  }

  authorizeUpload(input: Readonly<{ path: unknown; contentType: unknown; size: unknown; sha256: unknown; expiresIn: unknown; retentionUntil: unknown }>): Readonly<{
    reference: string; url: string; method: 'PUT'; headers: Readonly<Record<string, string>>; expiresAt: string;
  }> {
    const { path, contentType, size, sha256, expiresIn, retentionUntil } = input;
    if (typeof path !== 'string' || !OBJECT_PATH.test(path) || typeof contentType !== 'string' || !CONTENT_TYPE.test(contentType) ||
      !Number.isSafeInteger(size) || (size as number) < 1 || (size as number) > IMPORT_CAPACITY.maximumFileBytes ||
      typeof sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(sha256) || !Number.isSafeInteger(expiresIn) || (expiresIn as number) < 60 ||
      (expiresIn as number) > RUNTIME_LIMITS.upload.maximumAuthorizationSeconds || typeof retentionUntil !== 'string' ||
      !Number.isFinite(Date.parse(retentionUntil)) || Date.parse(retentionUntil) <= Date.now()) {
      throw new LocalHttpError(400, 'OBJECT_UPLOAD_AUTHORIZATION_INVALID');
    }
    const id = randomUUID();
    const reference = `local:object:${randomUUID()}`;
    const expires = Math.floor(Date.now() / 1000) + (expiresIn as number);
    this.uploads.set(id, { contentType, id, parts: [], path, reference, expectedHash: sha256, expectedSize: size as number,
      expiresAt: expires, retentionUntil: new Date(retentionUntil).toISOString(), size: 0 });
    const headers = Object.freeze({ 'content-type': contentType, 'content-length': String(size), 'x-content-sha256': sha256,
      'x-retention-until': new Date(retentionUntil).toISOString() });
    return Object.freeze({ reference, url: `${this.publicEndpoint}/v1/public-upload/${id}?expires=${expires}&signature=${this.uploadSignature(id, expires)}`,
      method: 'PUT', headers, expiresAt: new Date(expires * 1_000).toISOString() });
  }

  async writeAuthorized(id: string, expiresText: string | null, signature: string | null, headers: Readonly<Record<string, string>>, bytes: Uint8Array): Promise<ObjectMetadata> {
    const upload = this.upload(id);
    const expires = Number(expiresText);
    if (upload.expiresAt !== null && upload.expiresAt <= Math.floor(Date.now() / 1000)) {
      this.uploads.delete(id);
      throw new LocalHttpError(401, 'OBJECT_UPLOAD_GRANT_EXPIRED');
    }
    if (upload.expiresAt === null || !Number.isSafeInteger(expires) || expires !== upload.expiresAt ||
      !equalSecret(signature ?? undefined, this.uploadSignature(id, expires)) || headers['content-type'] !== upload.contentType ||
      headers['content-length'] !== String(upload.expectedSize) || headers['x-content-sha256'] !== upload.expectedHash ||
      headers['x-retention-until'] !== upload.retentionUntil || bytes.byteLength !== upload.expectedSize) {
      throw new LocalHttpError(401, 'OBJECT_UPLOAD_GRANT_INVALID');
    }
    for (let offset = 0; offset < bytes.byteLength; offset += RUNTIME_LIMITS.upload.maximumChunkBytes) {
      this.append(id, upload.parts.length, bytes.slice(offset, Math.min(bytes.byteLength, offset + RUNTIME_LIMITS.upload.maximumChunkBytes)));
    }
    return this.complete(id, upload.parts.length, upload.expectedHash, upload.expectedSize);
  }

  async lock(reference: string, until: unknown): Promise<Readonly<{ mode: 'compliance'; lockedUntil: string }>> {
    if (typeof until !== 'string' || !Number.isFinite(Date.parse(until)) || Date.parse(until) <= Date.now()) {
      throw new LocalHttpError(400, 'OBJECT_LOCK_INPUT_INVALID');
    }
    const metadata = await this.inspect(reference);
    const lockedUntil = new Date(Math.max(Date.parse(until), Date.parse(metadata.lockedUntil ?? until))).toISOString();
    await this.writeMetadata(Object.freeze({ ...metadata, lockedUntil }));
    return Object.freeze({ mode: 'compliance', lockedUntil });
  }

  async remove(reference: string): Promise<void> {
    const metadata = await this.inspect(reference);
    const protectedUntil = Math.max(Date.parse(metadata.retentionUntil ?? '1970-01-01T00:00:00.000Z'), Date.parse(metadata.lockedUntil ?? '1970-01-01T00:00:00.000Z'));
    if (protectedUntil > Date.now()) throw new LocalHttpError(409, 'OBJECT_RETENTION_ACTIVE');
    await Promise.all([
      rm(this.objectFile(reference), { force: true }),
      rm(this.metadataFile(this.objectId(reference)), { force: true }),
      rm(this.pathFile(metadata.path), { force: true }),
    ]);
  }

  async authorize(reference: string, expiresIn: unknown): Promise<Readonly<{ expiresAt: string; url: string }>> {
    await this.inspect(reference);
    if (!Number.isSafeInteger(expiresIn) || (expiresIn as number) < 60 || (expiresIn as number) > RUNTIME_LIMITS.upload.maximumAuthorizationSeconds) {
      throw new LocalHttpError(400, 'OBJECT_AUTHORIZATION_INVALID');
    }
    const expires = Math.floor(Date.now() / 1000) + (expiresIn as number);
    const signature = this.signature(reference, expires);
    return Object.freeze({
      expiresAt: new Date(expires * 1000).toISOString(),
      url: `${this.publicEndpoint}/v1/public/${encodeURIComponent(reference)}?expires=${expires}&signature=${signature}`,
    });
  }

  async readAuthorized(reference: string, expiresText: string | null, signature: string | null): Promise<Readonly<{ bytes: Uint8Array; metadata: ObjectMetadata }>> {
    const expires = Number(expiresText);
    if (!Number.isSafeInteger(expires) || expires <= Math.floor(Date.now() / 1000) || !equalSecret(signature ?? undefined, this.signature(reference, expires))) {
      throw new LocalHttpError(401, 'OBJECT_LINK_INVALID');
    }
    return this.read(reference);
  }

  private upload(id: string): UploadState {
    if (!UPLOAD_ID.test(id)) throw new LocalHttpError(404, 'OBJECT_UPLOAD_NOT_FOUND');
    const upload = this.uploads.get(id);
    if (!upload) throw new LocalHttpError(404, 'OBJECT_UPLOAD_NOT_FOUND');
    return upload;
  }

  private objectId(reference: string): string {
    if (!REFERENCE.test(reference)) throw new LocalHttpError(400, 'OBJECT_REFERENCE_INVALID');
    return reference.slice('local:object:'.length);
  }

  private metadataFile(id: string): string {
    return join(this.directory, 'metadata', `${id}.json`);
  }
  private objectFile(reference: string): string {
    return join(this.directory, 'objects', this.objectId(reference));
  }
  private pathFile(path: string): string {
    return join(this.directory, 'paths', createHash('sha256').update(path).digest('hex'));
  }
  private signature(reference: string, expires: number): string {
    return createHmac('sha256', this.token).update(`${reference}\n${expires}`).digest('base64url');
  }
  private uploadSignature(id: string, expires: number): string {
    return createHmac('sha256', this.token).update(`upload\n${id}\n${expires}`).digest('base64url');
  }
  private async writeMetadata(metadata: ObjectMetadata): Promise<void> {
    const id = this.objectId(metadata.reference);
    const temporary = join(this.directory, 'temporary', `${id}.metadata`);
    await writeFile(temporary, JSON.stringify(metadata), { mode: 0o600 });
    await rename(temporary, this.metadataFile(id));
  }
}

function validMetadata(value: unknown): value is ObjectMetadata {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Readonly<Record<string, unknown>>;
  return (
    typeof item.contentType === 'string' &&
    CONTENT_TYPE.test(item.contentType) &&
    typeof item.path === 'string' &&
    OBJECT_PATH.test(item.path) &&
    typeof item.reference === 'string' &&
    REFERENCE.test(item.reference) &&
    item.scan === 'clean' &&
    typeof item.sha256 === 'string' &&
    /^[a-f0-9]{64}$/.test(item.sha256) &&
    Number.isSafeInteger(item.size) &&
    (item.size as number) > 0 &&
    validTimestamp(item.retentionUntil) &&
    validTimestamp(item.lockedUntil)
  );
}

function validTimestamp(value: unknown): boolean {
  return value === null || typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function malware(bytes: Uint8Array): boolean {
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).includes(EICAR);
}

function isMissing(cause: unknown): boolean {
  return cause !== null && typeof cause === 'object' && 'code' in cause && cause.code === 'ENOENT';
}
