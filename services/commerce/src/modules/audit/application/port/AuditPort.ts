import { token } from '../../../../bootstrap/Container';
import type { AuditDatabase } from '../../../../foundation/application/AuditSink';
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
  previous(database: AuditDatabase, scope: string): Promise<string | null>;
  appendRecord(database: AuditDatabase, record: AuditRecord): Promise<void>;
  appendAccess(database: AuditDatabase, record: AccessRecord): Promise<void>;
  records(database: AuditDatabase, scope: string, cursor: Readonly<{ sort: string | null; id: string | null }>, fetch: number): Promise<readonly Readonly<Record<string, unknown>>[]>;
  archiveBatch(database: AuditDatabase, limit: number): Promise<ArchiveBatch | null>;
  completeArchive(database: AuditDatabase, batch: ArchiveBatch, object: Readonly<{ reference: string; sha256: string; size: number; keyVersion: string; expiresAt: string }>): Promise<void>;
  scheduleArchive(database: AuditDatabase, immediate: boolean): Promise<void>;
}

export const AUDIT_PORT = token<AuditPort>('audit.port');
