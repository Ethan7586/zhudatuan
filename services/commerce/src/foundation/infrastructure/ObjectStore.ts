import { createHash } from 'node:crypto';
import { token } from '../../bootstrap/Container';
import { HttpClient, type HttpCallMode } from '../http/HttpClient';
import { NetworkPolicy } from '../security/NetworkPolicy';

export interface StoredObject {
  readonly reference: string;
  readonly sha256: string;
  readonly size: number;
  readonly scan: 'clean';
}
export interface ObjectMetadata extends StoredObject {
  readonly contentType: string;
  readonly path: string;
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

export interface ObjectStore {
  create(path: string, contentType: string): Promise<ObjectUpload>;
  find(path: string): Promise<ObjectMetadata | null>;
  read(reference: string, maximum: number): Promise<Uint8Array>;
  inspect(reference: string): Promise<ObjectMetadata>;
  authorize(reference: string, seconds: number): Promise<Readonly<{ url: string; expiresAt: string }>>;
  authorizeUpload(input: Readonly<{ path: string; contentType: string; size: number; sha256: string; expiresIn: number }>): Promise<UploadAuthorization>;
}

export const OBJECT_STORE = token<ObjectStore>('object.store');

export class HttpObjectStore implements ObjectStore {
  private readonly http: HttpClient;
  constructor(
    private readonly endpoint: string,
    private readonly bearer: string,
    fetcher: typeof fetch = fetch
  ) {
    if (!endpoint.startsWith('https://') || bearer.length < 16) throw new Error('OBJECT_STORE_CONFIGURATION_INVALID');
    this.http = new HttpClient(fetcher, NetworkPolicy.service(endpoint));
  }

  async create(path: string, contentType: string): Promise<ObjectUpload> {
    if (!/^[a-z0-9][a-z0-9/.-]{2,255}$/.test(path) || !/^[a-z]+\/[a-z0-9.+-]+$/.test(contentType)) throw new Error('OBJECT_UPLOAD_METADATA_INVALID');
    const response = await this.call('/v1/uploads', { method: 'POST', body: JSON.stringify({ path, contentType }), headers: { 'content-type': 'application/json' } });
    const value = (await response.json()) as { id?: unknown };
    if (typeof value.id !== 'string' || !value.id) throw new Error('OBJECT_UPLOAD_RESPONSE_INVALID');
    return new HttpUpload(this, value.id);
  }

  async find(path: string): Promise<ObjectMetadata | null> {
    if (!/^[a-z0-9][a-z0-9/.-]{2,255}$/.test(path)) throw new Error('OBJECT_PATH_INVALID');
    const response = await this.http.send(
      `${this.endpoint.replace(/\/$/, '')}/v1/objects/metadata?path=${encodeURIComponent(path)}`,
      {
        headers: { accept: 'application/json', authorization: `Bearer ${this.bearer}` },
        redirect: 'error',
      },
      { mode: 'read' }
    );
    if (response.status === 404) return null;
    if (!response.ok) throw new Error('OBJECT_STORE_UNAVAILABLE');
    const value = (await response.json()) as Record<string, unknown>;
    if (
      typeof value.reference !== 'string' ||
      typeof value.sha256 !== 'string' ||
      !/^[a-f0-9]{64}$/.test(value.sha256) ||
      !Number.isSafeInteger(value.size) ||
      (value.size as number) < 1 ||
      value.scan !== 'clean' ||
      typeof value.contentType !== 'string' ||
      value.path !== path
    ) {
      throw new Error('OBJECT_METADATA_INVALID');
    }
    return { reference: value.reference, sha256: value.sha256, size: value.size as number, scan: 'clean', contentType: value.contentType, path };
  }

  async read(reference: string, maximum: number): Promise<Uint8Array> {
    if (!/^[a-z0-9][a-z0-9/.:_-]{2,2047}$/i.test(reference) || !Number.isSafeInteger(maximum) || maximum < 1 || maximum > 64 * 1024 * 1024) {
      throw new Error('OBJECT_READ_METADATA_INVALID');
    }
    const response = await this.call(`/v1/objects?reference=${encodeURIComponent(reference)}`, { method: 'GET' });
    const length = Number(response.headers.get('content-length'));
    if (Number.isFinite(length) && length > maximum) throw new Error('OBJECT_READ_TOO_LARGE');
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > maximum) throw new Error('OBJECT_READ_SIZE_INVALID');
    return bytes;
  }

  async inspect(reference: string): Promise<ObjectMetadata> {
    if (!/^[a-z0-9][a-z0-9/.:_-]{2,2047}$/i.test(reference)) throw new Error('OBJECT_REFERENCE_INVALID');
    const response = await this.call(`/v1/objects/metadata?reference=${encodeURIComponent(reference)}`, { method: 'GET' });
    const value = (await response.json()) as Record<string, unknown>;
    if (
      value.reference !== reference ||
      typeof value.sha256 !== 'string' ||
      !/^[a-f0-9]{64}$/.test(value.sha256) ||
      !Number.isSafeInteger(value.size) ||
      (value.size as number) < 1 ||
      value.scan !== 'clean' ||
      typeof value.contentType !== 'string' ||
      typeof value.path !== 'string' ||
      !/^[a-z0-9][a-z0-9/.-]{2,255}$/.test(value.path)
    )
      throw new Error('OBJECT_METADATA_INVALID');
    return { reference, sha256: value.sha256, size: value.size as number, scan: 'clean', contentType: value.contentType, path: value.path };
  }

  async authorize(reference: string, seconds: number): Promise<Readonly<{ url: string; expiresAt: string }>> {
    if (!/^[a-z0-9][a-z0-9/.:_-]{2,2047}$/i.test(reference) || !Number.isSafeInteger(seconds) || seconds < 60 || seconds > 900) {
      throw new Error('OBJECT_AUTHORIZATION_INVALID');
    }
    const response = await this.call('/v1/objects/authorizations', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reference, expiresIn: seconds }) });
    const value = (await response.json()) as Record<string, unknown>;
    if (typeof value.url !== 'string' || !value.url.startsWith('https://') || typeof value.expiresAt !== 'string' || Number.isNaN(Date.parse(value.expiresAt)) || Date.parse(value.expiresAt) <= Date.now())
      throw new Error('OBJECT_AUTHORIZATION_RESPONSE_INVALID');
    return Object.freeze({ url: value.url, expiresAt: value.expiresAt });
  }

  async authorizeUpload(input: Readonly<{ path: string; contentType: string; size: number; sha256: string; expiresIn: number }>): Promise<UploadAuthorization> {
    if (
      !/^[a-z0-9][a-z0-9/.-]{2,255}$/.test(input.path) ||
      !/^[a-z]+\/[a-z0-9.+-]+$/.test(input.contentType) ||
      !Number.isSafeInteger(input.size) ||
      input.size < 1 ||
      input.size > 10 * 1024 * 1024 ||
      !/^[a-f0-9]{64}$/.test(input.sha256) ||
      !Number.isSafeInteger(input.expiresIn) ||
      input.expiresIn < 60 ||
      input.expiresIn > 900
    ) {
      throw new Error('OBJECT_UPLOAD_AUTHORIZATION_INVALID');
    }
    const response = await this.call('/v1/uploads/authorizations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });
    const value = (await response.json()) as Record<string, unknown>;
    if (
      typeof value.reference !== 'string' ||
      !/^[a-z0-9][a-z0-9/.:_-]{2,2047}$/i.test(value.reference) ||
      typeof value.url !== 'string' ||
      !value.url.startsWith('https://') ||
      value.method !== 'PUT' ||
      typeof value.expiresAt !== 'string' ||
      Date.parse(value.expiresAt) <= Date.now() ||
      value.headers === null ||
      typeof value.headers !== 'object' ||
      Array.isArray(value.headers) ||
      !Object.values(value.headers).every((header) => typeof header === 'string')
    ) {
      throw new Error('OBJECT_UPLOAD_AUTHORIZATION_RESPONSE_INVALID');
    }
    return Object.freeze({ reference: value.reference, url: value.url, method: 'PUT', headers: Object.freeze(value.headers as Record<string, string>), expiresAt: value.expiresAt });
  }

  request(path: string, init: RequestInit): Promise<Response> {
    return this.call(path, init, mode(init));
  }

  private async call(path: string, init: RequestInit, callMode: HttpCallMode = mode(init)): Promise<Response> {
    const response = await this.http.send(`${this.endpoint.replace(/\/$/, '')}${path}`, { ...init, headers: { accept: 'application/json', authorization: `Bearer ${this.bearer}`, ...init.headers }, redirect: 'error' }, { mode: callMode });
    if (!response.ok) throw new Error('OBJECT_STORE_UNAVAILABLE');
    return response;
  }
}

function mode(init: RequestInit): HttpCallMode {
  return init.method === undefined || init.method === 'GET' ? 'read' : 'businesskeywrite';
}

class HttpUpload implements ObjectUpload {
  private readonly hash = createHash('sha256');
  private size = 0;
  private sequence = 0;
  private closed = false;

  constructor(
    private readonly store: HttpObjectStore,
    private readonly id: string
  ) {}

  async append(bytes: Uint8Array): Promise<void> {
    if (this.closed || bytes.byteLength === 0 || bytes.byteLength > 8 * 1024 * 1024) throw new Error('OBJECT_UPLOAD_CHUNK_INVALID');
    await this.store.request(`/v1/uploads/${encodeURIComponent(this.id)}/parts/${this.sequence}`, { method: 'PUT', body: bytes as BodyInit, headers: { 'content-type': 'application/octet-stream' } });
    this.hash.update(bytes);
    this.size += bytes.byteLength;
    this.sequence += 1;
  }

  async complete(): Promise<StoredObject> {
    if (this.closed || this.sequence === 0) throw new Error('OBJECT_UPLOAD_EMPTY');
    this.closed = true;
    const sha256 = this.hash.digest('hex');
    const response = await this.store.request(`/v1/uploads/${encodeURIComponent(this.id)}/completion`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ parts: this.sequence, sha256, size: this.size }),
    });
    const value = (await response.json()) as { reference?: unknown; sha256?: unknown; size?: unknown; scan?: unknown };
    if (typeof value.reference !== 'string' || value.sha256 !== sha256 || value.size !== this.size || value.scan !== 'clean') throw new Error('OBJECT_UPLOAD_INTEGRITY_INVALID');
    return { reference: value.reference, sha256, size: this.size, scan: 'clean' };
  }

  async abort(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    await this.store.request(`/v1/uploads/${encodeURIComponent(this.id)}`, { method: 'DELETE' });
  }
}
