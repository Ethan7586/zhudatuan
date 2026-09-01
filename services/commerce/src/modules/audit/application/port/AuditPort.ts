import { token } from '../../../../bootstrap/Container';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { AccessRecord } from '../../domain/model/AccessRecord';
import type { AuditRecord } from '../../domain/model/AuditRecord';

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

export interface AuditPort {
  previous(context: WriteTransactionContext, scope: string): Promise<string | null>;
  appendRecord(context: WriteTransactionContext, record: AuditRecord): Promise<void>;
  appendAccess(context: WriteTransactionContext, record: AccessRecord): Promise<void>;
  records(context: ReadTransactionContext, scope: string, cursor: Readonly<{ sort: string | null; id: string | null }>, fetch: number): Promise<readonly Readonly<Record<string, unknown>>[]>;
  archiveBatch(context: ReadTransactionContext, limit: number): Promise<ArchiveBatch | null>;
  completeArchive(context: WriteTransactionContext, batch: ArchiveBatch, object: Readonly<{ reference: string; sha256: string; size: number; keyVersion: string; expiresAt: string }>): Promise<void>;
  scheduleArchive(context: WriteTransactionContext, immediate: boolean): Promise<void>;
}

export const AUDIT_PORT = token<AuditPort>('audit.port');
