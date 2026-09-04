import { token } from '../../../../bootstrap/Container';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { AccessRecord } from '../../domain/model/AccessRecord';
import type { AuditRecord } from '../../domain/model/AuditRecord';
import type { EvidenceEntry } from '../../domain/model/EvidenceBundle';

export interface ArchiveBatch {
  readonly scope: string;
  readonly start: string;
  readonly end: string;
  readonly firstHash: string;
  readonly lastHash: string;
  readonly rows: readonly Readonly<Record<string, unknown>>[];
  readonly recordIds: readonly string[];
  readonly accessIds: readonly string[];
  readonly archiveYears: number;
}

export interface ArchiveObject {
  readonly reference: string;
  readonly sha256: string;
  readonly size: number;
  readonly keyVersion: string;
  readonly plaintextHash: string;
  readonly indexHash: string;
  readonly lockedUntil: string;
  readonly expiresAt: string;
  readonly entries: readonly EvidenceEntry[];
}

export interface ArchiveDisposal {
  readonly archive: string;
  readonly reference: string;
  readonly sha256: string;
  readonly scope: string;
}

export interface AuditRepository {
  previous(context: WriteTransactionContext, scope: string): Promise<string | null>;
  appendRecord(context: WriteTransactionContext, record: AuditRecord): Promise<void>;
  appendAccess(context: WriteTransactionContext, record: AccessRecord): Promise<void>;
  archiveBatch(context: ReadTransactionContext, limit: number): Promise<ArchiveBatch | null>;
  completeArchive(context: WriteTransactionContext, batch: ArchiveBatch, object: ArchiveObject): Promise<void>;
  disposalBatch(context: ReadTransactionContext): Promise<ArchiveDisposal | null>;
  completeDisposal(context: WriteTransactionContext, disposal: ArchiveDisposal, trace: string): Promise<void>;
  scheduleArchive(context: WriteTransactionContext, immediate: boolean): Promise<void>;
}

export const AUDIT_REPOSITORY = token<AuditRepository>('audit.repository');
