import { createHash, randomUUID } from 'node:crypto';
import { IMPORT_CAPACITY, RUNTIME_LIMITS } from '@shop/config/runtime';
import type { ObjectMetadata, ObjectStore } from '../../public/ObjectPort';
import { retentionUntil as objectRetentionUntil } from '@shop/kernel';
import type { UploadCategory, UploadPort, UploadRecord, UploadRequest } from '../../application/port/UploadPort';
import { assertObjectContent } from '../../domain/policy/ObjectContentPolicy';

/** Creates tenant-scoped upload grants and verifies the immutable scanned object. */
export class UploadSession implements UploadPort {
  constructor(private readonly objects: ObjectStore) {}

  async authorize(request: UploadRequest, now = new Date()): Promise<UploadRecord> {
    validate(request, now);
    const retentionUntil = objectRetentionUntil(request.retentionDays, now);
    const path = objectPath(request.tenant, request.category, request.name, request.contentType, now);
    const upload = await this.objects.authorizeUpload({ path, contentType: request.contentType, size: request.size, sha256: request.sha256, expiresIn: RUNTIME_LIMITS.upload.authorizationSeconds, retentionUntil });
    return Object.freeze({ reference: upload.reference, path, sha256: request.sha256, size: request.size, contentType: request.contentType, retentionUntil, upload });
  }

  async verify(record: Omit<UploadRecord, 'upload'>): Promise<ObjectMetadata> {
    const metadata = await this.objects.inspect(record.reference);
    if (metadata.scan !== 'clean' || metadata.path !== record.path || metadata.sha256 !== record.sha256 || metadata.size !== record.size || metadata.contentType !== record.contentType || metadata.retentionUntil !== record.retentionUntil) {
      throw new Error('UPLOAD_OBJECT_INVALID');
    }
    await verifyContent(this.objects, metadata);
    return metadata;
  }
}

function validate(request: UploadRequest, now: Date): void {
  const maximum =
    request.category === 'import'
      ? request.contentType.endsWith('spreadsheetml.sheet')
        ? IMPORT_CAPACITY.maximumSpreadsheetBytes
        : IMPORT_CAPACITY.maximumFileBytes
      : request.category === 'asset'
        ? RUNTIME_LIMITS.upload.maximumImageBytes
        : RUNTIME_LIMITS.upload.maximumAttachmentBytes;
  if (
    !Number.isFinite(now.getTime()) ||
    !request.tenant ||
    request.tenant.length > 255 ||
    !Number.isSafeInteger(request.size) ||
    request.size < 1 ||
    request.size > maximum ||
    !/^[a-f0-9]{64}$/.test(request.sha256) ||
    !Number.isSafeInteger(request.retentionDays) ||
    request.retentionDays < 1 ||
    request.retentionDays > RUNTIME_LIMITS.upload.maximumRetentionDays ||
    !allowedTypes(request.category).includes(request.contentType) ||
    extension(request.name, request.contentType) === null
  ) {
    throw new Error('UPLOAD_SESSION_INVALID');
  }
}

function objectPath(tenant: string, category: UploadCategory, name: string, contentType: string, now: Date): string {
  const owner = createHash('sha256').update(tenant).digest('hex').slice(0, 32);
  const suffix = extension(name, contentType);
  if (suffix === null) throw new Error('UPLOAD_SESSION_INVALID');
  const day = now.toISOString().slice(0, 10).replaceAll('-', '/');
  return `tenant/${owner}/${category}/${day}/${randomUUID()}${suffix}`;
}

function safeExtension(name: string): string {
  const normalized = name
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f/\\]/gu, '')
    .trim()
    .toLowerCase();
  return normalized.match(/\.(csv|xlsx|pdf|png|jpe?g)$/u)?.[0] ?? '';
}

function extension(name: string, contentType: string): string | null {
  const suffix = safeExtension(name);
  const expected = contentType === 'text/csv' ? ['.csv'] : contentType.endsWith('spreadsheetml.sheet') ? ['.xlsx'] : contentType === 'application/pdf' ? ['.pdf'] : contentType === 'image/png' ? ['.png'] : ['.jpg', '.jpeg'];
  return expected.includes(suffix) ? suffix : null;
}

function allowedTypes(category: UploadCategory): readonly string[] {
  if (category === 'import') return ['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
  return ['image/jpeg', 'image/png', 'application/pdf'];
}

async function verifyContent(objects: ObjectStore, metadata: ObjectMetadata): Promise<void> {
  const hash = createHash('sha256');
  const sample = new Uint8Array(Math.min(16, metadata.size));
  let sampled = 0;
  let size = 0;
  for await (const part of objects.chunks(metadata.reference, metadata.size)) {
    if (sampled < sample.byteLength) {
      const length = Math.min(part.byteLength, sample.byteLength - sampled);
      sample.set(part.subarray(0, length), sampled);
      sampled += length;
    }
    hash.update(part);
    size += part.byteLength;
  }
  if (size !== metadata.size || hash.digest('hex') !== metadata.sha256) throw new Error('UPLOAD_OBJECT_INVALID');
  assertObjectContent(metadata.contentType, sample.subarray(0, sampled));
}
