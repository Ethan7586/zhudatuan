import { DomainError } from '../../../../foundation/domain/DomainError';
import { createHash, randomUUID } from 'node:crypto';
import { bodyRecord, type OperationWireInput } from '../../../../foundation/interface/Validation';
import type { ObjectStore } from '../../../../foundation/infrastructure/ObjectStore';
import { mapParallel } from '../../../../foundation/performance/Parallel';

export interface VerifiedAfterSaleAttachment {
  readonly objectId: string;
  readonly name: string;
  readonly mediaType: string;
  readonly sizeBytes: number;
  readonly contentHash: string;
}

export class AfterSaleAttachmentService {
  constructor(private readonly objects: Pick<ObjectStore, 'create'>) {}

  async verify(input: OperationWireInput, membership: string): Promise<readonly VerifiedAfterSaleAttachment[]> {
    const raw = bodyRecord(input).attachments;
    if (raw === undefined) return Object.freeze([]);
    if (!Array.isArray(raw) || raw.length > 6) throw new DomainError('VALIDATION_FAILED', { field: 'attachments' });
    const owner = createHash('sha256').update(membership).digest('hex').slice(0, 32);
    const declaredBytes = raw.reduce((total, value) => total + encodedSize(value), 0);
    if (declaredBytes > 1_250_000) throw new DomainError('VALIDATION_FAILED', { field: 'attachments' });
    const verified = await mapParallel(raw, 3, (value) => this.upload(value, owner));
    if (new Set(verified.map(({ objectId }) => objectId)).size !== verified.length) throw new DomainError('VALIDATION_FAILED', { field: 'attachments' });
    return Object.freeze(verified);
  }

  private async upload(value: unknown, owner: string): Promise<VerifiedAfterSaleAttachment> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new DomainError('VALIDATION_FAILED', { field: 'attachments' });
    const item = value as Record<string, unknown>;
    if (typeof item.data !== 'string' || typeof item.contentType !== 'string' || typeof item.name !== 'string' || item.name.trim().length === 0 || item.name.length > 255) {
      throw new DomainError('VALIDATION_FAILED', { field: 'attachments' });
    }
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(item.data) || item.data.length % 4 !== 0) throw new DomainError('VALIDATION_FAILED', { field: 'attachments' });
    const bytes = new Uint8Array(Buffer.from(item.data, 'base64'));
    if (bytes.byteLength < 1 || bytes.byteLength > 1_000_000) throw new DomainError('VALIDATION_FAILED', { field: 'attachments' });
    const extension = item.name
      .trim()
      .toLowerCase()
      .match(/\.[a-z0-9]+$/)?.[0];
    const expected = item.contentType === 'image/jpeg' ? ['.jpg', '.jpeg'] : item.contentType === 'image/png' ? ['.png'] : item.contentType === 'application/pdf' ? ['.pdf'] : [];
    if (!extension || !expected.includes(extension) || !signatureMatches(bytes, item.contentType)) {
      throw new DomainError('VALIDATION_FAILED', { field: 'attachments' });
    }
    const upload = await this.objects.create(`aftersale/${owner}/${randomUUID()}${extension}`, item.contentType);
    try {
      await upload.append(bytes);
      const stored = await upload.complete();
      if (stored.scan !== 'clean' || stored.size !== bytes.byteLength || stored.sha256 !== createHash('sha256').update(bytes).digest('hex')) {
        throw new DomainError('VALIDATION_FAILED', { field: 'attachments' });
      }
      return Object.freeze({ objectId: stored.reference, name: item.name.trim(), mediaType: item.contentType, sizeBytes: stored.size, contentHash: stored.sha256 });
    } catch (cause) {
      await upload.abort().catch(() => undefined);
      if (cause instanceof DomainError) throw cause;
      throw new DomainError('VALIDATION_FAILED', { field: 'attachments' });
    }
  }
}

function encodedSize(value: unknown): number {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return Number.MAX_SAFE_INTEGER;
  const data = Reflect.get(value, 'data');
  return typeof data === 'string' ? Math.floor(data.length * 0.75) : Number.MAX_SAFE_INTEGER;
}

function signatureMatches(bytes: Uint8Array, contentType: string): boolean {
  if (contentType === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes.at(-2) === 0xff && bytes.at(-1) === 0xd9;
  if (contentType === 'image/png') return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value);
  if (contentType === 'application/pdf') return new TextDecoder().decode(bytes.slice(0, 5)) === '%PDF-';
  return false;
}
