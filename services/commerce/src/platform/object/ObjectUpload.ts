import { createHash } from 'node:crypto';
import { IMPORT_CAPACITY, RUNTIME_LIMITS } from '@shop/config/runtime';
import type { HttpCallMode } from '../http/HttpClient';
import { readExternalJson } from '../http/ExternalResponse';
import type { ObjectMetadata, ObjectUpload, StoredObject } from '../../modules/runtime/public/ObjectPort';

interface UploadStore {
  request(path: string, init: RequestInit): Promise<Response>;
}

export function validateRead(reference: string, maximum: number): void {
  if (!/^[a-z0-9][a-z0-9/.:_-]{2,2047}$/i.test(reference) || !Number.isSafeInteger(maximum) || maximum < 1 || maximum > IMPORT_CAPACITY.maximumFileBytes) {
    throw new Error('OBJECT_READ_METADATA_INVALID');
  }
}

export function mode(init: RequestInit): HttpCallMode {
  return init.method === undefined || init.method === 'GET' ? 'read' : 'businesskeywrite';
}

export class HttpUpload implements ObjectUpload {
  private readonly hash = createHash('sha256');
  private size = 0;
  private sequence = 0;
  private closed = false;

  constructor(
    private readonly store: UploadStore,
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

export function metadata(value: Record<string, unknown>, expected: Readonly<{ path?: string; reference?: string }>): ObjectMetadata {
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
  )
    throw new Error('OBJECT_METADATA_INVALID');
  return Object.freeze({ reference: value.reference, sha256: value.sha256, size: value.size as number, scan: 'clean', contentType: value.contentType, path: value.path, retentionUntil, lockedUntil });
}

export function timestamp(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (value === undefined) return undefined;
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : undefined;
}

export function uploadHeaders(value: unknown): Readonly<Record<string, string>> {
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
