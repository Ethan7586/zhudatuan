import { createHash } from 'node:crypto';
import { IMPORT_CAPACITY, RUNTIME_LIMITS } from '@shop/config/runtime';
import { HttpClient, type HttpCallMode } from '../../../../foundation/http/HttpClient';
import { invalidExternalResponse, readExternalJson, requireExternalResponse } from '../../../../foundation/http/ExternalResponse';
import { NetworkPolicy } from '../../../../foundation/security/NetworkPolicy';
import type { ObjectLock, ObjectMetadata, ObjectStore, ObjectUpload, StoredObject, UploadAuthorization } from '../../public/ObjectPort';

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
    const value = (await readExternalJson(response, 'OBJECT_STORE_UNAVAILABLE', 'OBJECT_UPLOAD_RESPONSE_INVALID')) as { id?: unknown };
    if (typeof value.id !== 'string' || !value.id) throw invalidExternalResponse('OBJECT_UPLOAD_RESPONSE_INVALID');
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
    const value = await readExternalJson(response, 'OBJECT_STORE_UNAVAILABLE', 'OBJECT_METADATA_INVALID');
    return metadata(value as Record<string, unknown>, { path });
  }

  async read(reference: string, maximum: number): Promise<Uint8Array> {
    const parts: Uint8Array[] = [];
    let size = 0;
    for await (const part of this.chunks(reference, maximum)) {
      parts.push(part);
      size += part.byteLength;
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const part of parts) {
      bytes.set(part, offset);
      offset += part.byteLength;
    }
    return bytes;
  }

  async *chunks(reference: string, maximum: number): AsyncIterable<Uint8Array> {
    validateRead(reference, maximum);
    const response = await this.call(`/v1/objects?reference=${encodeURIComponent(reference)}`, { method: 'GET' });
    const lengthHeader = response.headers.get('content-length');
    const length = lengthHeader === null ? Number.NaN : Number(lengthHeader);
    if (Number.isFinite(length) && (length < 1 || length > maximum)) throw new Error('OBJECT_READ_SIZE_INVALID');
    if (!response.body) throw new Error('OBJECT_READ_BODY_MISSING');
    const reader = response.body.getReader();
    let size = 0;
    let finished = false;
    try {
      while (true) {
        const item = await reader.read();
        if (item.done) {
          finished = true;
          break;
        }
        if (item.value.byteLength === 0) continue;
        size += item.value.byteLength;
        if (size > maximum) {
          await reader.cancel('OBJECT_READ_TOO_LARGE');
          throw new Error('OBJECT_READ_TOO_LARGE');
        }
        yield item.value;
      }
    } finally {
      if (!finished) await reader.cancel().catch(() => undefined);
      reader.releaseLock();
    }
    if (size === 0 || (Number.isFinite(length) && size !== length)) throw new Error('OBJECT_READ_SIZE_INVALID');
  }

  async inspect(reference: string): Promise<ObjectMetadata> {
    if (!/^[a-z0-9][a-z0-9/.:_-]{2,2047}$/i.test(reference)) throw new Error('OBJECT_REFERENCE_INVALID');
    const response = await this.call(`/v1/objects/metadata?reference=${encodeURIComponent(reference)}`, { method: 'GET' });
    return metadata((await readExternalJson(response, 'OBJECT_STORE_UNAVAILABLE', 'OBJECT_METADATA_INVALID')) as Record<string, unknown>, { reference });
  }

  async lock(reference: string, until: string): Promise<ObjectLock> {
    if (!/^[a-z0-9][a-z0-9/.:_-]{2,2047}$/i.test(reference) || !Number.isFinite(Date.parse(until)) || Date.parse(until) <= Date.now()) {
      throw new Error('OBJECT_LOCK_INPUT_INVALID');
    }
    const response = await this.call('/v1/objects/locks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reference, mode: 'compliance', until }),
    });
    const value = (await readExternalJson(response, 'OBJECT_STORE_UNAVAILABLE', 'OBJECT_LOCK_RESPONSE_INVALID')) as Record<string, unknown>;
    if (value.mode !== 'compliance' || typeof value.lockedUntil !== 'string' || Date.parse(value.lockedUntil) < Date.parse(until)) {
      throw new Error('OBJECT_LOCK_RESPONSE_INVALID');
    }
    return Object.freeze({ mode: 'compliance', lockedUntil: value.lockedUntil });
  }

  async remove(reference: string): Promise<void> {
    if (!/^[a-z0-9][a-z0-9/.:_-]{2,2047}$/i.test(reference)) throw new Error('OBJECT_REFERENCE_INVALID');
    const response = await this.http.send(
      `${this.endpoint.replace(/\/$/, '')}/v1/objects?reference=${encodeURIComponent(reference)}`,
      { method: 'DELETE', headers: { accept: 'application/json', authorization: `Bearer ${this.bearer}` }, redirect: 'error' },
      { mode: 'businesskeywrite' }
    );
    if (response.status !== 404) requireExternalResponse(response, 'OBJECT_STORE_UNAVAILABLE');
  }

  async authorize(reference: string, seconds: number): Promise<Readonly<{ url: string; expiresAt: string }>> {
    if (!/^[a-z0-9][a-z0-9/.:_-]{2,2047}$/i.test(reference) || !Number.isSafeInteger(seconds) || seconds < 60 || seconds > RUNTIME_LIMITS.upload.maximumAuthorizationSeconds) {
      throw new Error('OBJECT_AUTHORIZATION_INVALID');
    }
    const response = await this.call('/v1/objects/authorizations', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reference, expiresIn: seconds }) });
    const value = (await readExternalJson(response, 'OBJECT_STORE_UNAVAILABLE', 'OBJECT_AUTHORIZATION_RESPONSE_INVALID')) as Record<string, unknown>;
    if (typeof value.url !== 'string' || !value.url.startsWith('https://') || typeof value.expiresAt !== 'string' || Number.isNaN(Date.parse(value.expiresAt)) || Date.parse(value.expiresAt) <= Date.now())
      throw new Error('OBJECT_AUTHORIZATION_RESPONSE_INVALID');
    return Object.freeze({ url: value.url, expiresAt: value.expiresAt });
  }

  async authorizeUpload(input: Readonly<{ path: string; contentType: string; size: number; sha256: string; expiresIn: number; retentionUntil: string }>): Promise<UploadAuthorization> {
    if (
      !/^[a-z0-9][a-z0-9/.-]{2,255}$/.test(input.path) ||
      !/^[a-z]+\/[a-z0-9.+-]+$/.test(input.contentType) ||
      !Number.isSafeInteger(input.size) ||
      input.size < 1 ||
      input.size > IMPORT_CAPACITY.maximumFileBytes ||
      !/^[a-f0-9]{64}$/.test(input.sha256) ||
      !Number.isSafeInteger(input.expiresIn) ||
      input.expiresIn < 60 ||
      input.expiresIn > RUNTIME_LIMITS.upload.maximumAuthorizationSeconds ||
      !Number.isFinite(Date.parse(input.retentionUntil)) ||
      Date.parse(input.retentionUntil) <= Date.now()
    ) {
      throw new Error('OBJECT_UPLOAD_AUTHORIZATION_INVALID');
    }
    const response = await this.call('/v1/uploads/authorizations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });
    const value = (await readExternalJson(response, 'OBJECT_STORE_UNAVAILABLE', 'OBJECT_UPLOAD_AUTHORIZATION_RESPONSE_INVALID')) as Record<string, unknown>;
    const headers = uploadHeaders(value.headers);
    const expiresAt = typeof value.expiresAt === 'string' ? Date.parse(value.expiresAt) : Number.NaN;
    if (
      typeof value.reference !== 'string' ||
      !/^[a-z0-9][a-z0-9/.:_-]{2,2047}$/i.test(value.reference) ||
      typeof value.url !== 'string' ||
      !value.url.startsWith('https://') ||
      value.method !== 'PUT' ||
      !Number.isFinite(expiresAt) ||
      expiresAt <= Date.now() ||
      expiresAt > Date.now() + input.expiresIn * 1_000 + 5_000 ||
      headers['content-type'] !== input.contentType ||
      headers['content-length'] !== String(input.size) ||
      headers['x-content-sha256'] !== input.sha256 ||
      headers['x-retention-until'] !== input.retentionUntil
    ) {
      throw new Error('OBJECT_UPLOAD_AUTHORIZATION_RESPONSE_INVALID');
    }
    return Object.freeze({ reference: value.reference, url: value.url, method: 'PUT', headers, expiresAt: value.expiresAt as string });
  }

  request(path: string, init: RequestInit): Promise<Response> {
    return this.call(path, init, mode(init));
  }

  private async call(path: string, init: RequestInit, callMode: HttpCallMode = mode(init)): Promise<Response> {
    const response = await this.http.send(`${this.endpoint.replace(/\/$/, '')}${path}`, { ...init, headers: { accept: 'application/json', authorization: `Bearer ${this.bearer}`, ...init.headers }, redirect: 'error' }, { mode: callMode });
    requireExternalResponse(response, 'OBJECT_STORE_UNAVAILABLE');
    return response;
  }
}

function validateRead(reference: string, maximum: number): void {
  if (!/^[a-z0-9][a-z0-9/.:_-]{2,2047}$/i.test(reference) || !Number.isSafeInteger(maximum) || maximum < 1 || maximum > IMPORT_CAPACITY.maximumFileBytes) {
    throw new Error('OBJECT_READ_METADATA_INVALID');
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
    if (this.closed || bytes.byteLength === 0 || bytes.byteLength > RUNTIME_LIMITS.upload.maximumChunkBytes || this.size + bytes.byteLength > IMPORT_CAPACITY.maximumFileBytes) {
      throw new Error('OBJECT_UPLOAD_CHUNK_INVALID');
    }
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
    const value = (await readExternalJson(response, 'OBJECT_STORE_UNAVAILABLE', 'OBJECT_UPLOAD_RESPONSE_INVALID')) as { reference?: unknown; sha256?: unknown; size?: unknown; scan?: unknown };
    if (value.scan === 'infected') throw new Error('OBJECT_MALWARE_DETECTED');
    if (value.scan !== 'clean') throw new Error('OBJECT_SCAN_INCOMPLETE');
    if (typeof value.reference !== 'string' || value.sha256 !== sha256 || value.size !== this.size) throw new Error('OBJECT_UPLOAD_INTEGRITY_INVALID');
    return { reference: value.reference, sha256, size: this.size, scan: 'clean' };
  }

  async abort(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    await this.store.request(`/v1/uploads/${encodeURIComponent(this.id)}`, { method: 'DELETE' });
  }
}

function metadata(value: Record<string, unknown>, expected: Readonly<{ path?: string; reference?: string }>): ObjectMetadata {
  if (value.scan === 'infected') throw new Error('OBJECT_MALWARE_DETECTED');
  if (value.scan !== 'clean') throw new Error('OBJECT_SCAN_INCOMPLETE');
  const retentionUntil = timestamp(value.retentionUntil);
  const lockedUntil = timestamp(value.lockedUntil);
  if (
    typeof value.reference !== 'string' ||
    (expected.reference !== undefined && value.reference !== expected.reference) ||
    typeof value.sha256 !== 'string' ||
    !/^[a-f0-9]{64}$/.test(value.sha256) ||
    !Number.isSafeInteger(value.size) ||
    (value.size as number) < 1 ||
    typeof value.contentType !== 'string' ||
    !/^[a-z]+\/[a-z0-9.+-]+$/.test(value.contentType) ||
    typeof value.path !== 'string' ||
    !/^[a-z0-9][a-z0-9/.-]{2,255}$/.test(value.path) ||
    (expected.path !== undefined && value.path !== expected.path) ||
    retentionUntil === undefined ||
    lockedUntil === undefined
  ) throw new Error('OBJECT_METADATA_INVALID');
  return Object.freeze({ reference: value.reference, sha256: value.sha256, size: value.size as number, scan: 'clean', contentType: value.contentType,
    path: value.path, retentionUntil, lockedUntil });
}

function timestamp(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (value === undefined) return undefined;
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : undefined;
}

function uploadHeaders(value: unknown): Readonly<Record<string, string>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('OBJECT_UPLOAD_AUTHORIZATION_RESPONSE_INVALID');
  const headers: Record<string, string> = {};
  for (const [name, header] of Object.entries(value)) {
    const normalized = name.toLowerCase();
    if (!/^[a-z0-9-]{1,64}$/.test(normalized) || typeof header !== 'string' || normalized in headers) {
      throw new Error('OBJECT_UPLOAD_AUTHORIZATION_RESPONSE_INVALID');
    }
    headers[normalized] = header;
  }
  return Object.freeze(headers);
}
