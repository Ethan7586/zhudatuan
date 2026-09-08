import { createHash } from 'node:crypto';
import { TextDecoder, TextEncoder } from 'node:util';
import type { KmsClient } from '../../../../pipeline/KmsPort';
import type { ObjectStore, StoredObject } from '../../../runtime/public/ObjectPort';
import type { TransactionManager, TransactionOptions } from '../../../../platform/database/TransactionManager';
import { EvidenceBundle } from '../../domain/model/EvidenceBundle';
import type { ArchiveObject, AuditRepository, ArchiveBatch } from '../port/AuditRepository';

const BATCH_SIZE = 100;
const MAXIMUM_OBJECT = 64 * 1024 * 1024;

interface StoredArchive {
  readonly format: 'shop.audit.archive.v2';
  readonly scope: string;
  readonly firstHash: string;
  readonly lastHash: string;
  readonly count: number;
  readonly keyVersion: string;
  readonly fingerprint: string;
  readonly plaintextHash: string;
  readonly indexHash: string;
  readonly ciphertext: string;
}

export class ArchiveAudit {
  constructor(
    private readonly transactions: TransactionManager,
    private readonly objects: ObjectStore,
    private readonly kms: KmsClient,
    private readonly repository: AuditRepository
  ) {}

  async execute(trace: string, signal: AbortSignal, deadline: number): Promise<void> {
    const disposal = await this.transactions.read(this.options(trace, signal, deadline, 'audit.archive.disposal.read'), (context) => this.repository.disposalBatch(context));
    if (disposal) {
      await this.objects.remove(disposal.reference);
      await this.transactions.write(this.options(trace, signal, deadline, 'audit.archive.disposal.persist'), (context) => this.repository.completeDisposal(context, disposal, trace));
      return this.schedule(trace, true, signal, deadline);
    }
    const batch = await this.transactions.read(this.options(trace, signal, deadline, 'audit.archive.read'), (context) => this.repository.archiveBatch(context, BATCH_SIZE));
    if (!batch) return this.schedule(trace, false, signal, deadline);
    const bundle = new EvidenceBundle(batch.scope, batch.start, batch.end, batch.firstHash, batch.lastHash, batch.rows);
    const path = archivePath(batch);
    const expiry = expiryAt(batch.archiveYears);
    const existing = await this.objects.find(path);
    const sealed = existing ? await this.recover(existing, bundle) : await this.upload(path, bundle, signal);
    const archived = await this.verifyAndLock(path, sealed, expiry);
    await this.transactions.write(this.options(trace, signal, deadline, 'audit.archive.persist'), async (context) => {
      await this.repository.completeArchive(context, batch, archived);
      await this.repository.scheduleArchive(context, batch.rows.length === BATCH_SIZE);
    });
  }

  private async upload(path: string, bundle: EvidenceBundle, signal: AbortSignal) {
    const envelope = await this.kms.encrypt('evidence', 'audit/archive', bundle.plaintext, { scope: bundle.scope, lastHash: bundle.lastHash, plaintextHash: bundle.plaintextHash });
    const content: StoredArchive = {
      format: 'shop.audit.archive.v2',
      scope: bundle.scope,
      firstHash: bundle.firstHash,
      lastHash: bundle.lastHash,
      count: bundle.rows.length,
      keyVersion: envelope.keyVersion,
      fingerprint: envelope.fingerprint,
      plaintextHash: bundle.plaintextHash,
      indexHash: bundle.indexHash,
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
      return { object, content, bundle };
    } catch (cause) {
      await upload.abort();
      throw cause;
    }
  }

  private async recover(object: StoredObject & { readonly contentType: string }, expected: EvidenceBundle) {
    if (object.contentType !== 'application/json' || object.size > MAXIMUM_OBJECT) throw new Error('AUDIT_ARCHIVE_OBJECT_INVALID');
    const bytes = await this.objects.read(object.reference, MAXIMUM_OBJECT);
    if (createHash('sha256').update(bytes).digest('hex') !== object.sha256) throw new Error('AUDIT_ARCHIVE_OBJECT_HASH_MISMATCH');
    const content = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as Partial<StoredArchive>;
    if (
      content.format !== 'shop.audit.archive.v2' ||
      content.scope !== expected.scope ||
      content.firstHash !== expected.firstHash ||
      content.lastHash !== expected.lastHash ||
      content.count !== expected.rows.length ||
      typeof content.keyVersion !== 'string' ||
      typeof content.fingerprint !== 'string' ||
      !/^[a-f0-9]{64}$/.test(content.fingerprint) ||
      content.plaintextHash !== expected.plaintextHash ||
      content.indexHash !== expected.indexHash ||
      typeof content.ciphertext !== 'string' ||
      content.ciphertext.length < 16
    )
      throw new Error('AUDIT_ARCHIVE_OBJECT_MISMATCH');
    const plaintext = await this.kms.decrypt('evidence', 'audit/archive', content.ciphertext, { scope: expected.scope, lastHash: expected.lastHash, plaintextHash: expected.plaintextHash });
    if (createHash('sha256').update(plaintext).digest('hex') !== content.plaintextHash) throw new Error('AUDIT_ARCHIVE_PLAINTEXT_HASH_MISMATCH');
    const bundle = EvidenceBundle.restore(plaintext);
    if (bundle.indexHash !== expected.indexHash || bundle.plaintextHash !== expected.plaintextHash) throw new Error('AUDIT_ARCHIVE_BUNDLE_MISMATCH');
    return { object, content: content as StoredArchive, bundle };
  }

  private async verifyAndLock(path: string, sealed: Readonly<{ object: StoredObject; content: StoredArchive; bundle: EvidenceBundle }>, expiresAt: string): Promise<ArchiveObject> {
    const lock = await this.objects.lock(sealed.object.reference, expiresAt);
    const verified = await this.objects.inspect(sealed.object.reference);
    if (verified.path !== path || verified.contentType !== 'application/json' || verified.sha256 !== sealed.object.sha256 || verified.size !== sealed.object.size || verified.scan !== 'clean') {
      throw new Error('AUDIT_ARCHIVE_SEAL_VERIFICATION_FAILED');
    }
    if (Date.parse(lock.lockedUntil) < Date.parse(expiresAt)) throw new Error('AUDIT_ARCHIVE_LOCK_TOO_SHORT');
    return Object.freeze({
      reference: verified.reference,
      sha256: verified.sha256,
      size: verified.size,
      keyVersion: sealed.content.keyVersion,
      plaintextHash: sealed.bundle.plaintextHash,
      indexHash: sealed.bundle.indexHash,
      lockedUntil: lock.lockedUntil,
      expiresAt,
      entries: sealed.bundle.entries,
    });
  }

  private schedule(trace: string, immediate: boolean, signal: AbortSignal, deadline: number): Promise<void> {
    return this.transactions.write(this.options(trace, signal, deadline, 'audit.archive.schedule'), (context) => this.repository.scheduleArchive(context, immediate));
  }

  private options(trace: string, signal: AbortSignal, deadline: number, operation: string): TransactionOptions {
    return { tenant: 'system', membership: 'system', scope: 'audit', actor: 'system', trace, operation, deadline, signal, workload: 'jobs' };
  }
}

function archivePath(batch: ArchiveBatch): string {
  const scope = createHash('sha256').update(batch.scope).digest('hex').slice(0, 32);
  return `audit/${scope}/${batch.end.slice(0, 10)}/${batch.lastHash}.json`;
}

function expiryAt(years: number): string {
  const expiry = new Date();
  expiry.setUTCFullYear(expiry.getUTCFullYear() + years);
  return expiry.toISOString();
}
