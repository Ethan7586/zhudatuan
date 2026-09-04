import { createHash, randomUUID } from 'node:crypto';
import { RUNTIME_LIMITS } from '@shop/config/runtime';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { ObjectStore, UploadAuthorization } from '../../../runtime/public/ObjectPort';
import { retentionUntil as objectRetentionUntil } from '@shop/kernel';
import { bodyRecord, integerField, textField, type OperationWireInput } from '../../../../foundation/application/Validation';
import type { EvidenceKind } from '../../domain/model/Evidence';

type EvidenceContentType = 'image/jpeg' | 'image/png' | 'application/pdf';

export interface PreparedEvidenceUpload {
  readonly evidenceId: string;
  readonly kind: EvidenceKind;
  readonly sha256: string;
  readonly objectId: string;
  readonly upload: UploadAuthorization;
}

export class QualificationEvidence {
  constructor(private readonly objects: Pick<ObjectStore, 'authorizeUpload'>) {}

  async authorize(input: OperationWireInput, scope: string): Promise<PreparedEvidenceUpload> {
    const body = bodyRecord(input);
    const kind = textField(body, 'kind') as EvidenceKind;
    if (!['license', 'certificate', 'authorization', 'agreement', 'other'].includes(kind)) invalid('kind');
    const name = textField(body, 'name').normalize('NFKC').replace(/[\u0000-\u001f\u007f/\\]/g, '').trim();
    const contentType = textField(body, 'contentType') as EvidenceContentType;
    if (!['image/jpeg', 'image/png', 'application/pdf'].includes(contentType)) invalid('contentType');
    const size = integerField(body, 'sizeBytes', 1);
    if (size > 10 * 1024 * 1024) invalid('sizeBytes');
    const sha256 = textField(body, 'sha256', 64).toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(sha256)) invalid('sha256');
    const extension = extensionFor(name, contentType);
    const owner = createHash('sha256').update(scope).digest('hex').slice(0, 32);
    const evidenceId = `evidence:${randomUUID()}`;
    const upload = await this.objects.authorizeUpload({ path: `qualification/${owner}/${randomUUID()}${extension}`, contentType, size, sha256,
      expiresIn: RUNTIME_LIMITS.upload.authorizationSeconds, retentionUntil: objectRetentionUntil(RUNTIME_LIMITS.upload.retentionDays.qualification) });
    return Object.freeze({ evidenceId, kind, sha256, objectId: upload.reference, upload });
  }
}

function extensionFor(name: string, contentType: EvidenceContentType): string {
  const extension = name.toLowerCase().match(/\.[a-z0-9]+$/)?.[0];
  const allowed = contentType === 'image/jpeg' ? ['.jpg', '.jpeg'] : contentType === 'image/png' ? ['.png'] : ['.pdf'];
  if (!extension || !allowed.includes(extension)) invalid('name');
  return extension;
}

function invalid(field: string): never {
  throw new DomainError('VALIDATION_FAILED', { field });
}
