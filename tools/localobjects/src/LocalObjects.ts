import { createHash, createHmac, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { LocalHttpError, equalSecret } from '../../localinfra/src/Http';

const OBJECT_PATH = /^[a-z0-9][a-z0-9/.-]{2,255}$/;
const CONTENT_TYPE = /^[a-z]+\/[a-z0-9.+-]+$/;
const REFERENCE = /^local:object:[a-f0-9]{64}$/;
const UPLOAD_ID = /^[a-f0-9-]{36}$/;
const MAXIMUM_OBJECT_BYTES = 64 * 1024 * 1024;

export interface ObjectMetadata {
  readonly contentType: string;
  readonly path: string;
  readonly reference: string;
  readonly scan: 'clean';
  readonly sha256: string;
  readonly size: number;
}

interface UploadState {
  readonly contentType: string;
  readonly id: string;
  readonly parts: Uint8Array[];
  readonly path: string;
  size: number;
}

export class LocalObjects {
  private readonly uploads = new Map<string, UploadState>();

  constructor(private readonly directory: string, private readonly token: string, private readonly publicEndpoint: string) {
    if (token.length < 16 || !publicEndpoint.startsWith('https://')) throw new Error('LOCAL_OBJECTS_CONFIGURATION_INVALID');
  }

  async initialize(): Promise<void> {
    await Promise.all(['objects', 'metadata', 'paths', 'temporary'].map(name => mkdir(join(this.directory, name), { recursive: true })));
  }

  authorizeHeader(header: string | undefined): void {
    if (!header?.startsWith('Bearer ') || !equalSecret(header.slice(7), this.token)) throw new LocalHttpError(401, 'OBJECT_AUTHORIZATION_REQUIRED');
  }

  create(path: unknown, contentType: unknown): string {
    if (typeof path !== 'string' || !OBJECT_PATH.test(path) || typeof contentType !== 'string' || !CONTENT_TYPE.test(contentType)) {
      throw new LocalHttpError(400, 'OBJECT_UPLOAD_METADATA_INVALID');
    }
    const id = randomUUID();
    this.uploads.set(id, { contentType, id, parts: [], path, size: 0 });
    return id;
  }

  append(id: string, sequence: number, bytes: Uint8Array): void {
    const upload = this.upload(id);
    if (sequence !== upload.parts.length || bytes.byteLength === 0 || bytes.byteLength > 8 * 1024 * 1024 || upload.size + bytes.byteLength > MAXIMUM_OBJECT_BYTES) {
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
    if (!Number.isSafeInteger(parts) || parts !== upload.parts.length || parts === 0 || !Number.isSafeInteger(expectedSize)
      || expectedSize !== upload.size || typeof expectedHash !== 'string' || !/^[a-f0-9]{64}$/.test(expectedHash)) {
      throw new LocalHttpError(400, 'OBJECT_UPLOAD_INTEGRITY_INVALID');
    }
    const bytes = Buffer.concat(upload.parts.map(part => Buffer.from(part)));
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    if (sha256 !== expectedHash) throw new LocalHttpError(400, 'OBJECT_UPLOAD_INTEGRITY_INVALID');
<<<<<<< HEAD
<<<<<<< HEAD
    const referenceHash = createHash('sha256').update(`${id}\n${upload.path}\n${sha256}`, 'utf8').digest('hex');
    const reference = `local:object:${referenceHash}`;
=======
    const reference = `local:object:${sha256}`;
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
    const referenceHash = createHash('sha256').update(`${id}\n${upload.path}\n${sha256}`, 'utf8').digest('hex');
    const reference = `local:object:${referenceHash}`;
>>>>>>> 018b2a71 (chore(release): capture current production source)
    const metadata: ObjectMetadata = Object.freeze({
      contentType: upload.contentType,
      path: upload.path,
      reference,
      scan: 'clean',
      sha256,
      size: upload.size,
    });
    const temporary = join(this.directory, 'temporary', `${id}.object`);
    await writeFile(temporary, bytes, { mode: 0o600 });
<<<<<<< HEAD
<<<<<<< HEAD
    const previous = await this.find(upload.path);
    await rename(temporary, join(this.directory, 'objects', referenceHash));
    await writeFile(this.metadataFile(referenceHash), JSON.stringify(metadata), { mode: 0o600 });
    await writeFile(this.pathFile(upload.path), reference, { mode: 0o600 });
    if (previous !== undefined) await this.delete(previous.reference);
=======
    await rename(temporary, join(this.directory, 'objects', sha256));
    await writeFile(this.metadataFile(sha256), JSON.stringify(metadata), { mode: 0o600 });
    await writeFile(this.pathFile(upload.path), reference, { mode: 0o600 });
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
    const previous = await this.find(upload.path);
    await rename(temporary, join(this.directory, 'objects', referenceHash));
    await writeFile(this.metadataFile(referenceHash), JSON.stringify(metadata), { mode: 0o600 });
    await writeFile(this.pathFile(upload.path), reference, { mode: 0o600 });
    if (previous !== undefined) await this.delete(previous.reference);
>>>>>>> 018b2a71 (chore(release): capture current production source)
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
    const sha256 = this.hash(reference);
    try {
      const value: unknown = JSON.parse(await readFile(this.metadataFile(sha256), 'utf8'));
      if (!validMetadata(value) || value.reference !== reference) throw new Error('LOCAL_OBJECT_METADATA_CORRUPT');
      return Object.freeze(value);
    } catch (cause) {
      if (isMissing(cause)) throw new LocalHttpError(404, 'OBJECT_NOT_FOUND');
      throw cause;
    }
  }

  async read(reference: string): Promise<Readonly<{ bytes: Uint8Array; metadata: ObjectMetadata }>> {
    const metadata = await this.inspect(reference);
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
    const bytes = new Uint8Array(await readFile(join(this.directory, 'objects', this.hash(reference))));
    if (createHash('sha256').update(bytes).digest('hex') !== metadata.sha256 || bytes.byteLength !== metadata.size) {
      throw new Error('LOCAL_OBJECT_DATA_CORRUPT');
    }
    return Object.freeze({ bytes, metadata });
  }

  async delete(reference: string): Promise<void> {
    const metadata = await this.inspect(reference);
    const path = this.pathFile(metadata.path);
    try {
      if ((await readFile(path, 'utf8')).trim() === reference) await rm(path);
    } catch (cause) {
      if (!isMissing(cause)) throw cause;
    }
    await rm(this.metadataFile(this.hash(reference)), { force: true });
    await rm(join(this.directory, 'objects', this.hash(reference)), { force: true });
<<<<<<< HEAD
=======
    return Object.freeze({ bytes: new Uint8Array(await readFile(join(this.directory, 'objects', metadata.sha256))), metadata });
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
  }

  async authorize(reference: string, expiresIn: unknown): Promise<Readonly<{ expiresAt: string; url: string }>> {
    await this.inspect(reference);
    if (!Number.isSafeInteger(expiresIn) || (expiresIn as number) < 60 || (expiresIn as number) > 900) {
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

  private hash(reference: string): string {
    if (!REFERENCE.test(reference)) throw new LocalHttpError(400, 'OBJECT_REFERENCE_INVALID');
    return reference.slice('local:object:'.length);
  }

  private metadataFile(hash: string): string { return join(this.directory, 'metadata', `${hash}.json`); }
  private pathFile(path: string): string { return join(this.directory, 'paths', createHash('sha256').update(path).digest('hex')); }
  private signature(reference: string, expires: number): string {
    return createHmac('sha256', this.token).update(`${reference}\n${expires}`).digest('base64url');
  }
}

function validMetadata(value: unknown): value is ObjectMetadata {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Readonly<Record<string, unknown>>;
  return typeof item.contentType === 'string' && CONTENT_TYPE.test(item.contentType)
    && typeof item.path === 'string' && OBJECT_PATH.test(item.path)
    && typeof item.reference === 'string' && REFERENCE.test(item.reference)
    && item.scan === 'clean' && typeof item.sha256 === 'string' && /^[a-f0-9]{64}$/.test(item.sha256)
    && Number.isSafeInteger(item.size) && (item.size as number) > 0;
}

function isMissing(cause: unknown): boolean {
  return cause !== null && typeof cause === 'object' && 'code' in cause && cause.code === 'ENOENT';
}
