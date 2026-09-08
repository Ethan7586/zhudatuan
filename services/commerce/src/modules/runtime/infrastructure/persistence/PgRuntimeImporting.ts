import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import type { ImportFailure, ImportProgress, ImportTarget } from '../../public/ImportProcess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { ImportPort, RuntimeImportChunk, RuntimeImportCreated, RuntimeImportRecord, RuntimeStagedChunk } from '../../public/ImportPort';
import { IMPORT_CAPACITY } from '@shop/config/runtime';
import { PgImportEvidence } from './PgImportEvidence';
import { runtimeImportCreated, runtimeImportDigest, runtimeImportMetadata, runtimeImportRecord, type RuntimeImportRow } from './RuntimeImportValue';
import { PgRuntimeImportStore } from './PgRuntimeImportStore';
export class PgRuntimeImporting extends PgRuntimeImportStore implements ImportPort {
  async claim(context: WriteTransactionContext, id: string, owner: string, leaseSeconds: number): Promise<RuntimeImportChunk | null> {
    if (!Number.isSafeInteger(leaseSeconds) || leaseSeconds < 1 || leaseSeconds > IMPORT_CAPACITY.chunkLeaseSeconds) throw new Error('RUNTIME_IMPORT_LEASE_INVALID');
    const database = this.transactions.database(context);
    const result = await database.query<{ sequence: number; token: number; payload: RuntimeImportChunk['rows'] }>(
      `with selected as(select chunk.id from runtime.import_chunks chunk join runtime.imports target on target.id=chunk.import_id
       where chunk.import_id=$1 and target.scope_id=$3 and target.owner=$4::text and target.state in('ready','running')
         and not exists(select 1 from runtime.import_errors failure where failure.import_id=target.id)
         and (chunk.state in('pending','failed') or chunk.state='running' and chunk.lease_expires_at<=clock_timestamp())
       order by chunk.sequence limit 1 for update of chunk skip locked)
       update runtime.import_chunks target set state='running',fencing_token=coalesce(target.fencing_token,0)+1,version=target.version+1,
       lease_expires_at=clock_timestamp()+make_interval(secs=>$2),updated_at=clock_timestamp()
       from selected where target.id=selected.id returning target.sequence,target.fencing_token::integer token,target.payload`,
      [id, leaseSeconds, context.scope, owner]
    );
    if (!result.rows[0]) {
      const busy = await database.query(
        `select 1 from runtime.import_chunks chunk join runtime.imports target on target.id=chunk.import_id
         where chunk.import_id=$1 and target.scope_id=$2 and target.owner=$3 and chunk.state<>'succeeded' limit 1`,
        [id, context.scope, owner]
      );
      if (busy.rows[0]) throw new Error('RUNTIME_IMPORT_CHUNK_BUSY');
      return null;
    }
    const running = await database.query(
      `update runtime.imports set state='running',version=version+1,updated_at=clock_timestamp(),updated_by='job:import'
      where id=$1 and scope_id=$2 and owner=$3 and state in('ready','running') returning id`,
      [id, context.scope, owner]
    );
    if (running.rows.length !== 1) throw new Error('RUNTIME_IMPORT_CHUNK_LEASE_LOST');
    return Object.freeze({ sequence: result.rows[0].sequence, token: Number(result.rows[0].token), rows: Object.freeze(result.rows[0].payload.map((item) => Object.freeze(item))) });
  }

  async assertLease(context: WriteTransactionContext, id: string, owner: string, chunk: number, token: number): Promise<void> {
    const locked = await this.transactions.database(context).query(
      `select 1 from runtime.import_chunks target join runtime.imports parent on parent.id=target.import_id
       where target.import_id=$1 and target.sequence=$2 and target.fencing_token=$3 and target.state='running'
         and target.lease_expires_at>clock_timestamp() and parent.scope_id=$4 and parent.owner=$5 and parent.state='running' for share of target,parent`,
      [id, chunk, token, context.scope, owner]
    );
    if (locked.rows.length !== 1) throw new Error('RUNTIME_IMPORT_CHUNK_LEASE_LOST');
  }

  async finish(context: WriteTransactionContext, id: string, owner: string, chunk: number, token: number, succeeded: number, failures: readonly ImportFailure[]): Promise<boolean> {
    const database = this.transactions.database(context);
    const locked = await database.query<{ rows: number; rowStart: number; rowEnd: number }>(
      `select (target.row_end-target.row_start+1)::integer rows,target.row_start::integer "rowStart",target.row_end::integer "rowEnd"
       from runtime.import_chunks target join runtime.imports parent on parent.id=target.import_id
       where target.import_id=$1 and target.sequence=$2 and target.fencing_token=$3 and target.state='running'
       and target.lease_expires_at>clock_timestamp() and parent.scope_id=$4 and parent.owner=$5 and parent.state='running' for update of target`,
      [id, chunk, token, context.scope, owner]
    );
    const lease = locked.rows[0];
    const failureRows = failures.map(({ row }) => row);
    if (
      !lease ||
      !Number.isSafeInteger(succeeded) ||
      succeeded < 0 ||
      succeeded + failures.length !== Number(lease.rows) ||
      new Set(failureRows).size !== failureRows.length ||
      failureRows.some((row) => !Number.isSafeInteger(row) || row < Number(lease.rowStart) || row > Number(lease.rowEnd))
    ) {
      throw new Error('RUNTIME_IMPORT_CHUNK_LEASE_LOST');
    }
    if (failures.length > 0) await this.evidence.store(context, id, owner, failures);
    const completed = await database.query(
      `with finished as(update runtime.import_chunks set state='succeeded',lease_expires_at=null,error_count=$5,
       checkpoint=jsonb_build_object('succeeded',$4::integer,'failed',$5::integer,'token',$3::bigint),version=version+1,updated_at=clock_timestamp()
       where import_id=$1 and sequence=$2 and fencing_token=$3 and state='running' returning row_end-row_start+1 rows)
       update runtime.imports target set rows_processed=rows_processed+finished.rows,rows_succeeded=rows_succeeded+$4,rows_failed=rows_failed+$5,
       checkpoint=checkpoint||jsonb_build_object('lastChunk',$2::integer,'lastToken',$3::bigint),version=version+1,updated_at=clock_timestamp(),updated_by='job:import'
       from finished where target.id=$1 and target.scope_id=$6 and target.owner=$7 and target.state='running' returning target.id`,
      [id, chunk, token, succeeded, failures.length, context.scope, owner]
    );
    if (completed.rows.length !== 1) throw new Error('RUNTIME_IMPORT_CHUNK_LEASE_LOST');
    const remaining = await database.query(
      `select 1 from runtime.import_chunks chunk join runtime.imports target on target.id=chunk.import_id
      where chunk.import_id=$1 and target.scope_id=$2 and target.owner=$3 and chunk.state<>'succeeded' limit 1`,
      [id, context.scope, owner]
    );
    return remaining.rows.length === 0;
  }

  async abandon(context: WriteTransactionContext, id: string, owner: string, chunk: number, token: number, detail: string): Promise<void> {
    await this.transactions.database(context).query(
      `with released as(update runtime.import_chunks chunk set state='failed',lease_expires_at=null,
       checkpoint=checkpoint||jsonb_build_object('lastError',$4::text,'token',$3::bigint),version=version+1,updated_at=clock_timestamp()
       where chunk.import_id=$1 and chunk.sequence=$2 and chunk.fencing_token=$3 and chunk.state='running'
       and exists(select 1 from runtime.imports parent where parent.id=chunk.import_id and parent.scope_id=$5 and parent.owner=$6 and parent.state='running')
       returning chunk.import_id)
       update runtime.imports target set checkpoint=checkpoint||jsonb_build_object('code','IMPORT_PROCESSING_FAILED','lastError',$4::text),
       version=version+1,updated_at=clock_timestamp(),updated_by='job:import' from released
       where target.id=released.import_id and target.scope_id=$5 and target.owner=$6 and target.state='running'`,
      [id, chunk, token, detail.slice(0, 500), context.scope, owner]
    );
  }

  async failures(context: ReadTransactionContext, id: string, owner: string): Promise<readonly ImportFailure[]> {
    return this.evidence.read(context, id, owner);
  }

  async progress(context: ReadTransactionContext, id: string, owner: string): Promise<ImportProgress | null> {
    const result = await this.transactions.database(context).query<{ total: number | string; processed: number | string; succeeded: number | string; failed: number | string }>(
      `select coalesce(rows_total,0) total,rows_processed processed,rows_succeeded succeeded,rows_failed failed
       from runtime.imports where id=$1 and scope_id=$2 and owner=$3`,
      [id, context.scope, owner]
    );
    const row = result.rows[0];
    if (!row) return null;
    const progress = Object.freeze({ total: Number(row.total), processed: Number(row.processed), succeeded: Number(row.succeeded), failed: Number(row.failed) });
    if (!Object.values(progress).every((value) => Number.isSafeInteger(value) && value >= 0) || progress.processed > progress.total || progress.succeeded + progress.failed > progress.processed)
      throw new Error('RUNTIME_IMPORT_PROGRESS_INVALID');
    return progress;
  }

  async report(context: WriteTransactionContext, id: string, owner: string, report: Readonly<{ reference: string; sha256: string; size: number }>): Promise<void> {
    await this.evidence.attach(context, id, owner, report);
  }
  async complete(context: WriteTransactionContext, id: string, owner: string, report: Readonly<{ reference: string; sha256: string; size: number }>): Promise<void> {
    const result = await this.transactions.database(context).query(
      `update runtime.imports set state=case when rows_failed>0 then 'rejected' else 'succeeded' end,error_report_key=$2,
       checkpoint=checkpoint||jsonb_build_object('reportSha256',$3::text,'reportSize',$4::bigint),
       version=version+1,updated_at=clock_timestamp(),updated_by='job:import'
       where id=$1 and scope_id=$5 and owner=$6 and state='running' and rows_processed=rows_total`,
      [id, report.reference, report.sha256, report.size, context.scope, owner]
    );
    if (result.rowCount !== 1) throw new Error('RUNTIME_IMPORT_COMPLETE_CONFLICT');
  }

  async reject(context: WriteTransactionContext, id: string, owner: string, code: string, detail: string): Promise<void> {
    await this.fail(context, id, owner, code, detail, 'failed');
  }
  async fault(context: WriteTransactionContext, id: string, owner: string, detail: string): Promise<void> {
    await this.transactions.database(context).query(
      `update runtime.imports set checkpoint=checkpoint||jsonb_build_object('code','IMPORT_PROCESSING_FAILED','lastError',$2::text),
      version=version+1,updated_at=clock_timestamp(),updated_by='job:import'
      where id=$1 and scope_id=$3 and owner=$4 and state in('preflight','ready','running')`,
      [id, detail.slice(0, 500), context.scope, owner]
    );
  }
  private async fail(context: WriteTransactionContext, id: string, owner: string, code: string, detail: string, state: 'failed'): Promise<void> {
    await this.transactions.database(context).query(
      `update runtime.imports set state=$2,checkpoint=checkpoint||jsonb_build_object('code',$3::text,'lastError',$4::text),
      version=version+1,updated_at=clock_timestamp(),updated_by='job:import'
      where id=$1 and scope_id=$5 and owner=$6 and state not in('succeeded','cancelled')`,
      [id, state, code, detail.slice(0, 500), context.scope, owner]
    );
  }
}
