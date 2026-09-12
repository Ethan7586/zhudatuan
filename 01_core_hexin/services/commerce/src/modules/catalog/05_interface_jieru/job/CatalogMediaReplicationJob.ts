import type { ClaimedJob, JobProcessor } from '../../../../foundation/application/JobRunner';
import type { DatabasePool } from '../../../../foundation/persistence/Pool';
import type {
  CatalogProductMediaRegistration,
  CatalogProductMediaRegistrationResult,
} from '../../03_application_yingyong/CatalogProductMediaRegistration';
import type { CatalogMediaPurpose } from '../../03_application_yingyong/port/CatalogMediaObjectStorage';

interface CatalogMediaReplicationPayload {
  readonly productId: string;
  readonly sourceUrls: readonly string[];
  readonly purpose: CatalogMediaPurpose;
  readonly position: number;
}

type MediaRegistration = Pick<CatalogProductMediaRegistration, 'register'>;

export class CatalogMediaReplicationProcessor implements JobProcessor {
  constructor(
    private readonly pool: DatabasePool,
    private readonly registration: MediaRegistration,
    private readonly primaryTargetId: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async process(job: ClaimedJob, signal: AbortSignal): Promise<void> {
    if (job.kind !== 'catalogmediareplication') throw new Error('JOB_KIND_MISMATCH');
    if (signal.aborted) throw signal.reason;
    const payload = mediaPayload(job.payload);
    const source = await this.download(payload.sourceUrls, signal);
    const result = await this.registration.register(this.pool, {
      productId: payload.productId,
      bytes: source.bytes,
      contentType: source.contentType,
      purpose: payload.purpose,
      position: payload.position,
    });
    const publicUrl = verifiedPrimaryUrl(result, this.primaryTargetId);
    const updated = await this.pool.query(`update catalog.product
      set attributes=jsonb_set(coalesce(attributes,'{}'::jsonb),'{coverUrl}',to_jsonb($2::text),true),
        version=version+1,updated_at=clock_timestamp()
      where id=$1`, [payload.productId, publicUrl]);
    if (updated.rowCount !== 1) throw new Error('CATALOG_MEDIA_PRODUCT_NOT_FOUND');
  }

  private async download(sourceUrls: readonly string[], signal: AbortSignal): Promise<{
    readonly bytes: Uint8Array;
    readonly contentType: string;
  }> {
    for (const sourceUrl of sourceUrls) {
      if (signal.aborted) throw signal.reason;
      try {
        const response = await this.fetcher(sourceUrl, { signal });
        if (!response.ok) continue;
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (bytes.byteLength === 0) continue;
        return Object.freeze({
          bytes,
          contentType: response.headers.get('content-type')?.split(';', 1)[0]?.trim() || 'application/octet-stream',
        });
      } catch (cause) {
        if (signal.aborted) throw signal.reason ?? cause;
      }
    }
    throw new Error('CATALOG_MEDIA_SOURCE_UNAVAILABLE');
  }
}

function verifiedPrimaryUrl(result: CatalogProductMediaRegistrationResult, primaryTargetId: string): string {
  if (result.bindingStatus !== 'ready' || result.overallStatus !== 'complete') {
    throw new Error('CATALOG_MEDIA_REPLICATION_INCOMPLETE');
  }
  const replica = result.replicas.find(({ targetId }) => targetId === primaryTargetId);
  if (!replica || replica.uploadStatus !== 'uploaded' || replica.verificationStatus !== 'verified') {
    throw new Error('CATALOG_MEDIA_PRIMARY_REPLICA_UNAVAILABLE');
  }
  return replica.publicUrl;
}

function mediaPayload(value: unknown): CatalogMediaReplicationPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('CATALOG_MEDIA_JOB_PAYLOAD_INVALID');
  const payload = value as Record<string, unknown>;
  if (typeof payload.productId !== 'string' || payload.productId.trim().length === 0
    || !Array.isArray(payload.sourceUrls) || payload.sourceUrls.length === 0
    || payload.sourceUrls.some((url) => typeof url !== 'string' || url.trim().length === 0)
    || !['cover', 'gallery', 'detail'].includes(String(payload.purpose))
    || !Number.isSafeInteger(payload.position) || Number(payload.position) < 0) {
    throw new Error('CATALOG_MEDIA_JOB_PAYLOAD_INVALID');
  }
  return Object.freeze({
    productId: payload.productId.trim(),
    sourceUrls: Object.freeze(payload.sourceUrls.map((url) => String(url).trim())),
    purpose: payload.purpose as CatalogMediaPurpose,
    position: Number(payload.position),
  });
}
