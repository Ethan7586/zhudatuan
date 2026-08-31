import { randomUUID } from 'node:crypto';
import type { ClaimedJob, JobDeadletter } from '../../foundation/application/JobRunner';

export class VoucherDeadletter implements JobDeadletter {
  async record(database: Readonly<{ query(text: string, values?: readonly unknown[]): Promise<unknown> }>, job: ClaimedJob, error: string): Promise<void> {
    if (job.kind === 'voucherissue') return this.issue(database, identifier(job.payload, 'batch', 'VOUCHER_BATCH_REQUIRED'), error);
    if (job.kind === 'voucherimport') return this.import(database, identifier(job.payload, 'import', 'VOUCHER_IMPORT_REQUIRED'), error);
    if (job.kind === 'voucherstatus') return this.status(database, identifier(job.payload, 'batch', 'VOUCHER_BATCH_REQUIRED'), error);
  }

  private async issue(database: Readonly<{ query(text: string, values?: readonly unknown[]): Promise<unknown> }>, batchid: string, error: string): Promise<void> {
    await database.query(
      `with failed as (update voucher.issuebatch batch set state='failed' from voucher.program program
        where batch.id=$1 and batch.program_id=program.id and batch.state='issuing'
        returning batch.cardpool_id,batch.requested_count-batch.issued_count released,program.scope_id),
      owned as (select failed.cardpool_id,failed.released,failed.scope_id,pool.scope_id owner_scope
        from failed join voucher.cardpool pool on pool.id=failed.cardpool_id)
      update voucher.allocation allocation set used_count=greatest(0,used_count-owned.released),version=version+1,updated_at=clock_timestamp()
      from owned where owned.owner_scope<>owned.scope_id and allocation.cardpool_id=owned.cardpool_id and allocation.scope_id=owned.scope_id`,
      [batchid]
    );
    await database.query(
      `insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,occurred_at,available_at)
      select $1,'voucher.issue.failed',1,'issuebatch',batch.id,program.scope_id,
        jsonb_build_object('batch',batch.id,'error',$2),$1,clock_timestamp(),clock_timestamp()
      from voucher.issuebatch batch join voucher.program program on program.id=batch.program_id where batch.id=$3
      on conflict(id) do nothing`,
      [`event:${randomUUID()}`, error, batchid]
    );
  }

  private async import(database: Readonly<{ query(text: string, values?: readonly unknown[]): Promise<unknown> }>, importid: string, error: string): Promise<void> {
    await database.query(
      `with failed as (update voucher.importjob set state='failed',updated_at=clock_timestamp() where id=$1
        returning cardpool_id,scope_id) update voucher.cardpool pool set status='disabled',version=version+1 from failed where pool.id=failed.cardpool_id`,
      [importid]
    );
    await database.query(
      `insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,occurred_at,available_at)
      select $1,'voucher.import.failed',1,'importjob',job.id,job.scope_id,jsonb_build_object('import',job.id,'error',$2),$1,
        clock_timestamp(),clock_timestamp() from voucher.importjob job where job.id=$3 on conflict(id) do nothing`,
      [`event:${randomUUID()}`, error, importid]
    );
  }

  private async status(database: Readonly<{ query(text: string, values?: readonly unknown[]): Promise<unknown> }>, batchid: string, error: string): Promise<void> {
    await database.query(
      `update voucher.statusitem set state='failed',error_code=$2,updated_at=clock_timestamp()
      where batch_id=$1 and state='queued'`,
      [batchid, error]
    );
    await database.query(
      `update voucher.statusbatch batch set state='failed',
      succeeded_count=(select count(*) from voucher.statusitem where batch_id=batch.id and state='succeeded'),
      failed_count=(select count(*) from voucher.statusitem where batch_id=batch.id and state='failed'),updated_at=clock_timestamp() where id=$1`,
      [batchid]
    );
    await database.query(
      `insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,occurred_at,available_at)
      select $1,'voucher.status.failed',1,'statusbatch',batch.id,batch.scope_id,jsonb_build_object('batch',batch.id,'error',$2),$1,
        clock_timestamp(),clock_timestamp() from voucher.statusbatch batch where batch.id=$3`,
      [`event:${randomUUID()}`, error, batchid]
    );
  }
}

function identifier(payload: unknown, field: string, code: string): string {
  const value = payload !== null && typeof payload === 'object' ? Reflect.get(payload, field) : null;
  if (typeof value !== 'string' || !value) throw new Error(code);
  return value;
}
