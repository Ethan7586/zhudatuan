import { PgTransactionAccess, type SqlExecutor } from '../../../../platform/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import { createHash, randomUUID } from 'node:crypto';
import type { DirectoryRepository, DirectoryCounts, StagedSubject, CurrentDirectorySubject, DirectoryApplyKind, DirectoryDeparture } from '../../application/port/DirectoryRepository';
import type { DirectoryPage } from '../../application/port/DirectoryProvider';
import { DirectoryConnection, type DirectoryConnectionValue } from '../../domain/model/DirectoryConnection';
import type { SyncRun, SyncMode } from '../../domain/model/SyncRun';
import { activeRunColumns, mapConnection, mapRun, runColumns, runSummary, type ConnectionRow, type ConnectionSummaryRow, type RunRow, type RunSummaryRow } from './DirectoryRecord';
import { PgDirectorySubjectStore } from './PgDirectorySubjectStore';
export class PgDirectorySubjectRepository {
  protected readonly transactions = new PgTransactionAccess();
  protected readonly subjects = new PgDirectorySubjectStore();
  async current(context: ReadTransactionContext, connection: string, hashes: readonly Buffer[]): Promise<ReadonlyMap<string, CurrentDirectorySubject>> {
    return this.subjects.current(context, connection, hashes);
  }
  async apply(context: WriteTransactionContext, connection: DirectoryConnection, subject: StagedSubject, kind: DirectoryApplyKind): Promise<void> {
    return this.subjects.apply(context, connection, subject, kind);
  }
  async advance(context: WriteTransactionContext, run: string, page: DirectoryPage, counts: DirectoryCounts): Promise<boolean> {
    const database = this.transactions.database(context);
    const result = await database.query(
      `update organization.syncrun set cursor_ciphertext=$2,read_count=read_count+$3,applied_count=applied_count+$4,
      create_count=create_count+$5,update_count=update_count+$6,freeze_count=freeze_count+$7,restore_count=restore_count+$8,
      conflict_count=conflict_count+$9,ignored_count=ignored_count+$10,watermark=clock_timestamp(),
      checksum=encode(public.digest(coalesce(checksum,'')||$11||':'||$12::text,'sha256'),'hex') where id=$1 and state='running'`,
      [run, page.cursor, counts.read, counts.applied, counts.creates, counts.updates, counts.freezes, counts.restores, counts.conflicts, counts.ignored, page.eventid, page.version]
    );
    return result.rowCount === 1;
  }
  async complete(context: WriteTransactionContext, run: string, connection: string, version: number, cursor: string | null): Promise<void> {
    const database = this.transactions.database(context);
    const result = await database.query<{
      started_at: Date;
      mode: SyncMode;
      preview_only: boolean;
    }>(
      `update organization.syncrun set state='completed',completed_at=clock_timestamp(),watermark=clock_timestamp()
      where id=$1 and state='running' and checksum is not null returning started_at,mode,preview_only`,
      [run]
    );
    const completed = result.rows[0];
    if (!completed) throw new Error('DIRECTORY_SYNC_STATE_INVALID');
    if (!completed.preview_only && completed.mode === 'full')
      await database.query(
        `update organization.directorysubject set missing_count=least(2,missing_count+1),version=version+1
      where connection_id=$1 and last_seen_at<$2 and status not in('deleted','conflict')`,
        [connection, completed.started_at]
      );
    if (!completed.preview_only)
      await database.query(
        `update organization.directoryconnection set successful_version=greatest(successful_version,$2),cursor_ciphertext=$3,
      version=version+1,updated_at=clock_timestamp() where id=$1`,
        [connection, version, cursor]
      );
  }
  async departures(context: ReadTransactionContext, connection: string): Promise<readonly DirectoryDeparture[]> {
    return this.subjects.departures(context, connection);
  }
  async previewDepartures(context: ReadTransactionContext, connection: string, run: string): Promise<readonly DirectoryDeparture[]> {
    const result = await this.transactions.database(context).query<DirectoryDeparture>(
      `select subject.id subject,membership.membership_id membership,membership.organization_id organization
       from organization.directorysubject subject
       join organization.directorymembership membership on membership.subject_id=subject.id and membership.connection_id=subject.connection_id
       join organization.syncrun run on run.id=$2 and run.connection_id=subject.connection_id and run.preview_only and run.mode='full'
       where subject.connection_id=$1 and subject.type='user' and least(2,subject.missing_count+1)>=2 and subject.status='active'
         and membership.membership_id is not null and membership.status='active'
         and not exists(select 1 from organization.directorypreviewsubject seen where seen.run_id=run.id and seen.subject_hash=subject.subject_hash)
       order by subject.id limit 1000`,
      [connection, run]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze(row)));
  }
  async recordDepartures(context: WriteTransactionContext, run: string, count: number): Promise<void> {
    if (count === 0) return;
    const result = await this.transactions.database(context).query(
      `update organization.syncrun set read_count=read_count+$2,applied_count=applied_count+$2,freeze_count=freeze_count+$2
       where id=$1 and state='completed'`,
      [run, count]
    );
    if (result.rowCount !== 1) throw new Error('DIRECTORY_SYNC_DEPARTURE_COUNT_FAILED');
  }
  async freeze(context: WriteTransactionContext, connection: string, subject: string): Promise<void> {
    return this.subjects.freeze(context, connection, subject);
  }
  async fail(context: WriteTransactionContext, run: string, code: string): Promise<void> {
    const database = this.transactions.database(context);
    await database.query(
      `update organization.syncrun set state='failed',
    error_summary=$2,completed_at=clock_timestamp() where id=$1 and state in('queued','running')`,
      [run, code.slice(0, 200)]
    );
  }
  async markEventProcessed(context: WriteTransactionContext, connection: string, event: string): Promise<void> {
    await this.transactions.database(context).query(`update organization.directoryinbox set state='processed',processed_at=clock_timestamp() where connection_id=$1 and provider_event_id=$2`, [connection, event]);
  }
}
