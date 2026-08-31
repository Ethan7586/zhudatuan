import { createHash } from 'node:crypto';
import { TextDecoder, TextEncoder } from 'node:util';
import type { ClaimedJob, JobProcessor } from '../../../../foundation/application/JobRunner';
import type { KmsClient } from '../../../../foundation/infrastructure/KmsClient';
import type { ObjectStore, StoredObject } from '../../../../foundation/infrastructure/ObjectStore';
import type { DatabasePool } from '../../../../foundation/persistence/Pool';
import type { AuditPort, ArchiveBatch } from '../../application/port/AuditPort';

const BATCH_SIZE = 100;
const MAXIMUM_OBJECT = 64 * 1024 * 1024;

interface StoredArchive {
  readonly format: 'shop.audit.archive.v1';
  readonly scope: string;
  readonly firstHash: string;
  readonly lastHash: string;
  readonly count: number;
  readonly keyVersion: string;
  readonly fingerprint: string;
  readonly ciphertext: string;
}

export class AuditArchiveJobProcessor implements JobProcessor {
  constructor(
    private readonly pool: DatabasePool,
    private readonly objects: ObjectStore,
    private readonly kms: KmsClient,
    private readonly repository: AuditPort
  ) {}

  async process(job: ClaimedJob, signal: AbortSignal): Promise<void> {
    if (job.kind !== 'auditarchive') throw new Error('JOB_KIND_MISMATCH');
    if (signal.aborted) throw signal.reason;
    const batch = await this.repository.archiveBatch(this.pool, BATCH_SIZE);
    if (!batch) return this.schedule(false);
    const path = archivePath(batch);
    const existing = await this.objects.find(path);
    const archived = existing ? await this.recover(existing, batch) : await this.upload(path, batch, signal);
    const expiry = new Date();
    expiry.setUTCFullYear(expiry.getUTCFullYear() + batch.archiveYears);
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      await this.repository.completeArchive(client, batch, { reference: archived.object.reference, sha256: archived.object.sha256, size: archived.object.size, keyVersion: archived.keyVersion, expiresAt: expiry.toISOString() });
      await this.repository.scheduleArchive(client, batch.rows.length === BATCH_SIZE);
      await client.query('commit');
    } catch (cause) {
      await client.query('rollback');
      throw cause;
    } finally {
      client.release();
    }
  }

  private async upload(path: string, batch: ArchiveBatch, signal: AbortSignal) {
    const plaintext = JSON.stringify({ format: 'shop.audit.plain.v1', scope: batch.scope, start: batch.start, end: batch.end, firstHash: batch.firstHash, lastHash: batch.lastHash, count: batch.rows.length, rows: batch.rows });
    const envelope = await this.kms.encrypt('evidence', 'audit/archive', plaintext, { scope: batch.scope, lastHash: batch.lastHash });
    const content: StoredArchive = {
      format: 'shop.audit.archive.v1',
      scope: batch.scope,
      firstHash: batch.firstHash,
      lastHash: batch.lastHash,
      count: batch.rows.length,
      keyVersion: envelope.keyVersion,
      fingerprint: envelope.fingerprint,
      ciphertext: envelope.ciphertext,
    };
    const bytes = new TextEncoder().encode(JSON.stringify(content));
    if (bytes.byteLength > MAXIMUM_OBJECT) throw new Error('AUDIT_ARCHIVE_OBJECT_TOO_LARGE');
    const upload = await this.objects.create(path, 'application/json');
    try {
      for (let offset = 0; offset < bytes.byteLength; offset += 8 * 1024 * 1024) {
        if (signal.aborted) throw signal.reason;
        await upload.append(bytes.slice(offset, Math.min(bytes.byteLength, offset + 8 * 1024 * 1024)));
      }
      const object = await upload.complete();
      return { object, keyVersion: envelope.keyVersion };
    } catch (cause) {
      await upload.abort();
      throw cause;
    }
  }

  private async recover(object: StoredObject & { readonly contentType: string }, batch: ArchiveBatch) {
    if (object.contentType !== 'application/json' || object.size > MAXIMUM_OBJECT) throw new Error('AUDIT_ARCHIVE_OBJECT_INVALID');
    const bytes = await this.objects.read(object.reference, MAXIMUM_OBJECT);
    if (createHash('sha256').update(bytes).digest('hex') !== object.sha256) throw new Error('AUDIT_ARCHIVE_OBJECT_HASH_MISMATCH');
    const content = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as Partial<StoredArchive>;
    if (
      content.format !== 'shop.audit.archive.v1' ||
      content.scope !== batch.scope ||
      content.firstHash !== batch.firstHash ||
      content.lastHash !== batch.lastHash ||
      content.count !== batch.rows.length ||
      typeof content.keyVersion !== 'string' ||
      typeof content.fingerprint !== 'string' ||
      !/^[a-f0-9]{64}$/.test(content.fingerprint) ||
      typeof content.ciphertext !== 'string' ||
      content.ciphertext.length < 16
    )
      throw new Error('AUDIT_ARCHIVE_OBJECT_MISMATCH');
    return { object, keyVersion: content.keyVersion };
  }

  private async schedule(immediate: boolean): Promise<void> {
    await this.repository.scheduleArchive(this.pool, immediate);
  }
}

function archivePath(batch: ArchiveBatch): string {
  const scope = createHash('sha256').update(batch.scope).digest('hex').slice(0, 32);
  return `audit/${scope}/${batch.end.slice(0, 10)}/${batch.lastHash}.json`;
}
