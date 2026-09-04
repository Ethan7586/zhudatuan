import { DomainError } from '../../../../foundation/domain/DomainError';
import { createHash, randomUUID } from 'node:crypto';
import { RUNTIME_LIMITS } from '@shop/config/runtime';
import { bodyRecord, integerField, textField, type OperationWireInput } from '../../../../foundation/application/Validation';
import type { ObjectStore, UploadAuthorization } from '../../../runtime/public/ObjectPort';
import { retentionUntil as objectRetentionUntil } from '@shop/kernel';
import { mapParallel } from '../../../../foundation/performance/Parallel';

export interface PreparedAfterSaleAttachment {
  readonly objectId: string;
  readonly upload: UploadAuthorization;
}

export interface VerifiedAfterSaleAttachment {
  readonly objectId: string;
  readonly name: string;
  readonly mediaType: string;
  readonly sizeBytes: number;
  readonly contentHash: string;
}

type AttachmentType = 'image/jpeg' | 'image/png' | 'application/pdf';

export class AfterSaleAttachment {
  constructor(private readonly objects: Pick<ObjectStore, 'authorizeUpload' | 'inspect'>) {}

  async authorize(input: OperationWireInput, membership: string): Promise<PreparedAfterSaleAttachment> {
    const body = bodyRecord(input);
    const name = nameField(body);
    const contentType = contentTypeField(body);
    const size = integerField(body, 'sizeBytes', 1);
    const sha256 = textField(body, 'sha256', 64).toLowerCase();
    if (size > 1_000_000 || !/^[a-f0-9]{64}$/.test(sha256)) throw new DomainError('VALIDATION_FAILED', { field: 'attachment' });
    const extension = extensionFor(name, contentType);
    const owner = ownerFor(membership);
    const upload = await this.objects.authorizeUpload({ path: `aftersale/${owner}/${randomUUID()}${extension}`, contentType, size, sha256,
      expiresIn: RUNTIME_LIMITS.upload.authorizationSeconds, retentionUntil: objectRetentionUntil(RUNTIME_LIMITS.upload.retentionDays.aftersale) });
    return Object.freeze({ objectId: upload.reference, upload });
  }

  async verify(input: OperationWireInput, membership: string): Promise<readonly VerifiedAfterSaleAttachment[]> {
    const raw = bodyRecord(input).attachments;
    if (raw === undefined) return Object.freeze([]);
    if (!Array.isArray(raw) || raw.length > 6) throw new DomainError('VALIDATION_FAILED', { field: 'attachments' });
    const owner = ownerFor(membership);
    const declaredBytes = raw.reduce((total, value) => total + declaredSize(value), 0);
    if (declaredBytes > 1_250_000) throw new DomainError('VALIDATION_FAILED', { field: 'attachments' });
    const verified = await mapParallel(raw, 2, (value) => this.inspect(value, owner));
    if (new Set(verified.map(({ objectId }) => objectId)).size !== verified.length) throw new DomainError('VALIDATION_FAILED', { field: 'attachments' });
    return Object.freeze(verified);
  }

  private async inspect(value: unknown, owner: string): Promise<VerifiedAfterSaleAttachment> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new DomainError('VALIDATION_FAILED', { field: 'attachments' });
    const item = value as Record<string, unknown>;
    const name = nameField(item);
    const contentType = contentTypeField(item);
    const objectId = textField(item, 'objectId', 2048);
    const size = integerField(item, 'sizeBytes', 1);
    const sha256 = textField(item, 'sha256', 64).toLowerCase();
    const extension = extensionFor(name, contentType);
    if (size > 1_000_000 || !/^[a-f0-9]{64}$/.test(sha256)) throw new DomainError('VALIDATION_FAILED', { field: 'attachments' });
    let stored;
    try { stored = await this.objects.inspect(objectId); }
    catch { throw new DomainError('VALIDATION_FAILED', { field: 'attachments' }); }
    if (
      stored.reference !== objectId ||
      stored.sha256 !== sha256 ||
      stored.size !== size ||
      stored.contentType !== contentType ||
      stored.scan !== 'clean' ||
      stored.retentionUntil === null ||
      Date.parse(stored.retentionUntil) <= Date.now() ||
      !stored.path.startsWith(`aftersale/${owner}/`) ||
      !stored.path.endsWith(extension)
    ) throw new DomainError('VALIDATION_FAILED', { field: 'attachments' });
    return Object.freeze({ objectId, name, mediaType: contentType, sizeBytes: size, contentHash: sha256 });
  }
}

function ownerFor(membership: string): string { return createHash('sha256').update(membership).digest('hex').slice(0, 32); }
function nameField(value: Record<string, unknown>): string {
  const name = textField(value, 'name', 255).normalize('NFKC').replace(/[\u0000-\u001f\u007f/\\]/g, '').trim();
  if (!name) throw new DomainError('VALIDATION_FAILED', { field: 'name' });
  return name;
}
function contentTypeField(value: Record<string, unknown>): AttachmentType {
  const contentType = textField(value, 'contentType') as AttachmentType;
  if (!['image/jpeg', 'image/png', 'application/pdf'].includes(contentType)) throw new DomainError('VALIDATION_FAILED', { field: 'contentType' });
  return contentType;
}
function extensionFor(name: string, contentType: AttachmentType): string {
  const extension = name.toLowerCase().match(/\.[a-z0-9]+$/)?.[0];
  const allowed = contentType === 'image/jpeg' ? ['.jpg', '.jpeg'] : contentType === 'image/png' ? ['.png'] : ['.pdf'];
  if (!extension || !allowed.includes(extension)) throw new DomainError('VALIDATION_FAILED', { field: 'name' });
  return extension;
}
function declaredSize(value: unknown): number {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return Number.MAX_SAFE_INTEGER;
  const size = Reflect.get(value, 'sizeBytes');
  return Number.isSafeInteger(size) && size > 0 ? size : Number.MAX_SAFE_INTEGER;
}
