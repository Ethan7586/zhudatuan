import { createHash } from 'node:crypto';
import type {
  CatalogMediaObjectStorage,
  CatalogMediaPurpose,
  CatalogMediaStorageResolver,
  CatalogMediaTarget,
} from './port/CatalogMediaObjectStorage';

type CatalogMediaIdentity =
  | { readonly mediaId: string; readonly productId?: never }
  | { readonly mediaId?: never; readonly productId: string };

export type CatalogMediaReplicationInput = CatalogMediaIdentity & {
  readonly bytes: Uint8Array;
  readonly contentType: string;
  readonly purpose: CatalogMediaPurpose;
};

export type CatalogMediaUploadStatus = 'uploaded' | 'failed';
export type CatalogMediaVerificationStatus = 'verified' | 'failed';

export interface CatalogMediaReplicaResult {
  readonly targetId: string;
  readonly provider: string;
  readonly bucket: string;
  readonly publicUrl: string;
  readonly required: boolean;
  readonly uploadStatus: CatalogMediaUploadStatus;
  readonly verificationStatus: CatalogMediaVerificationStatus;
  readonly error: string | null;
}

export interface CatalogMediaReplicationResult {
  readonly mediaId: string;
  readonly objectKey: string;
  readonly sha256: string;
  readonly contentType: string;
  readonly byteSize: number;
  readonly overallStatus: 'complete' | 'incomplete';
  readonly replicas: readonly CatalogMediaReplicaResult[];
}

export class CatalogMediaReplication {
  constructor(
    private readonly mediaTargets: readonly CatalogMediaTarget[],
    private readonly resolveStorage: CatalogMediaStorageResolver,
  ) {}

  async replicate(input: CatalogMediaReplicationInput): Promise<CatalogMediaReplicationResult> {
    const sha256 = digest(input.bytes);
    const mediaId = input.mediaId ?? `media:${digest(`product:${input.productId}:${input.purpose}`)}`;
    const objectKey = `catalog-media/${digest(mediaId)}/${input.purpose}/${sha256}`;
    const targets = this.mediaTargets.filter(({ enabled }) => enabled);
    const replicas = await Promise.all(targets.map((target) => this.replicateToTarget(
      target,
      objectKey,
      input.bytes,
      input.contentType,
      sha256,
    )));
    const requiredComplete = replicas
      .filter(({ required }) => required)
      .every(({ uploadStatus, verificationStatus }) => uploadStatus === 'uploaded' && verificationStatus === 'verified');

    return Object.freeze({
      mediaId,
      objectKey,
      sha256,
      contentType: input.contentType,
      byteSize: input.bytes.byteLength,
      overallStatus: requiredComplete ? 'complete' : 'incomplete',
      replicas: Object.freeze(replicas),
    });
  }

  private async replicateToTarget(
    target: CatalogMediaTarget,
    objectKey: string,
    bytes: Uint8Array,
    contentType: string,
    sha256: string,
  ): Promise<CatalogMediaReplicaResult> {
    const base = {
      targetId: target.id,
      provider: target.provider,
      bucket: target.bucket,
      publicUrl: `${target.publicBaseUrl.replace(/\/$/, '')}/${objectKey}`,
      required: target.required,
    };
    let storage: CatalogMediaObjectStorage;
    try {
      storage = this.resolveStorage(target);
      await storage.upload({ objectKey, bytes, contentType, sha256 });
    } catch (cause) {
      return Object.freeze({
        ...base,
        uploadStatus: 'failed' as const,
        verificationStatus: 'failed' as const,
        error: errorMessage(cause),
      });
    }

    try {
      const stored = await storage.inspect(objectKey);
      const verificationError = !stored.exists
        ? 'CATALOG_MEDIA_OBJECT_MISSING'
        : stored.byteSize !== bytes.byteLength
          ? 'CATALOG_MEDIA_BYTE_SIZE_MISMATCH'
          : stored.sha256 !== sha256
            ? 'CATALOG_MEDIA_SHA256_MISMATCH'
            : null;
      return Object.freeze({
        ...base,
        uploadStatus: 'uploaded' as const,
        verificationStatus: verificationError === null ? 'verified' as const : 'failed' as const,
        error: verificationError,
      });
    } catch (cause) {
      return Object.freeze({
        ...base,
        uploadStatus: 'uploaded' as const,
        verificationStatus: 'failed' as const,
        error: errorMessage(cause),
      });
    }
  }
}

function digest(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
