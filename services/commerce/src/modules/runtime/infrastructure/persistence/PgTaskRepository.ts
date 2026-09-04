import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { TaskConfirmation, TaskMutation, TaskQuery, TaskRepository } from '../../application/port/TaskRepository';
import { ExportRegistry } from '../../application/registry/ExportRegistry';
import { ImportRegistry } from '../../application/registry/ImportRegistry';
import { JobRegistry } from '../../application/registry/JobRegistry';
import { ExportTask } from '../../domain/model/ExportTask';
import { ImportTask } from '../../domain/model/ImportTask';
import { Job } from '../../domain/model/Job';
import type { RuntimeTask, RuntimeTaskData, RuntimeTaskState, RuntimeTaskType } from '../../domain/model/Task';

interface TaskRow {
  readonly id: string;
  readonly type: RuntimeTaskType;
  readonly owner: string;
  readonly kind: string;
  readonly state: RuntimeTaskState;
  readonly processed: number | string;
  readonly total: number | string;
  readonly succeeded: number | string;
  readonly failed: number | string;
  readonly retryableItems: number | string;
  readonly version: number | string;
  readonly createdAt: Date | string;
  readonly updatedAt: Date | string;
  readonly expiresAt: Date | string | null;
  readonly fileName: string | null;
  readonly downloadAvailable: boolean;
  readonly cancelRequested: boolean;
  readonly confirmationRequired: boolean;
  readonly previewHash: string | null;
  readonly columns: readonly string[];
  readonly validationErrors: number | string;
}

const taskSelect = `with tasks as(
  select job.id,job.scope_id,'job'::text type,job.owner,job.kind,
    case job.state when 'succeeded' then 'completed' when 'deadlettered' then 'failed' else job.state end state,
    case when job.checkpoint->>'processed'~'^\d+$' then (job.checkpoint->>'processed')::bigint else 0 end processed,
    case when job.checkpoint->>'total'~'^\d+$' then (job.checkpoint->>'total')::bigint else 0 end total,
    case when job.checkpoint->>'succeeded'~'^\d+$' then (job.checkpoint->>'succeeded')::bigint else 0 end succeeded,
    case when job.checkpoint->>'failed'~'^\d+$' then (job.checkpoint->>'failed')::bigint else 0 end failed,
    case when job.checkpoint->>'retryable'~'^\d+$' then (job.checkpoint->>'retryable')::bigint else 0 end "retryableItems",
    job.version,job.created_at "createdAt",job.updated_at "updatedAt",
    null::timestamptz "expiresAt",null::text "fileName",false "downloadAvailable",job.cancel_requested_at is not null "cancelRequested",
    false "confirmationRequired",null::text "previewHash",'[]'::jsonb columns,0::bigint "validationErrors",job.created_by
  from runtime.jobs job
  union all
  select target.id,target.scope_id,'import'::text,target.owner,target.kind,
    case when target.state='uploaded' then 'queued' when target.state in('scanning','preflight') then 'validating'
      when target.state='succeeded' then 'completed' when target.state='rejected' then 'failed' else target.state end,
    target.rows_processed,coalesce(target.rows_total,0),target.rows_succeeded,target.rows_failed,target.rows_failed,target.version,
    target.created_at,target.updated_at,target.retention_until,target.file_name,
    target.error_report_key is not null and target.retention_until>clock_timestamp(),false,
    target.state='ready' and not(target.checkpoint ? 'confirmedAt') "confirmationRequired",target.checkpoint->>'previewHash' "previewHash",
    coalesce(target.checkpoint->'columns','[]'::jsonb) columns,
    (select count(*) from runtime.import_errors failure where failure.import_id=target.id) "validationErrors",target.created_by
  from runtime.imports target
  union all
  select target.id,target.scope_id,'export'::text,target.owner,target.kind,
    case when target.state='ready' and target.download_expires_at<=clock_timestamp() then 'expired'
      when target.state='ready' then 'completed' else target.state end,
    case when target.state='ready' then target.rows_exported else 0 end,
    case when target.state='ready' then target.rows_exported else 0 end,
    case when target.state='ready' then target.rows_exported else 0 end,0,0,target.version,target.created_at,target.updated_at,
    target.download_expires_at,case when target.object_key is null then null else regexp_replace(target.object_key,'^.*/','') end,
    target.state='ready' and target.downloaded_at is null and target.download_expires_at>clock_timestamp(),false,
    false,null::text,'[]'::jsonb,0::bigint,target.created_by
  from runtime.exports target
)`;

export class PgTaskRepository implements TaskRepository {
  constructor(
    private readonly transactions = new PgTransactionAccess(),
    private readonly jobs = new JobRegistry(),
    private readonly imports = new ImportRegistry(),
    private readonly exports = new ExportRegistry()
  ) {}

  async list(context: ReadTransactionContext, query: TaskQuery): Promise<readonly RuntimeTask[]> {
    const result = await this.transactions.database(context).query<TaskRow>(`${taskSelect}
      select id,type,owner,kind,state,processed,total,succeeded,failed,"retryableItems",version,"createdAt","updatedAt","expiresAt","fileName","downloadAvailable","cancelRequested","confirmationRequired","previewHash",columns,"validationErrors"
      from tasks where scope_id=$1 and $1=nullif(current_setting('app.scope_id',true),'') and created_by=$2
        and ($3::text is null or type=$3) and ($4::text is null or state=$4) and ($5::text is null or owner=$5)
        and ($6::timestamptz is null or ("createdAt",id)<($6::timestamptz,$7))
      order by "createdAt" desc,id desc limit $8`,
    [query.scope, query.actor, query.type, query.state, query.owner, query.cursorTime, query.cursorId, query.fetch]);
    return Object.freeze(result.rows.map((row) => this.task(row)));
  }

  async read(context: ReadTransactionContext, id: string, scope: string, actor: string): Promise<RuntimeTask | null> {
    const result = await this.transactions.database(context).query<TaskRow>(`${taskSelect}
      select id,type,owner,kind,state,processed,total,succeeded,failed,"retryableItems",version,"createdAt","updatedAt","expiresAt","fileName","downloadAvailable","cancelRequested","confirmationRequired","previewHash",columns,"validationErrors"
      from tasks where id=$1 and scope_id=$2 and $2=nullif(current_setting('app.scope_id',true),'') and created_by=$3`, [id, scope, actor]);
    return result.rows[0] ? this.task(result.rows[0]) : null;
  }

  async cancel(context: WriteTransactionContext, input: TaskMutation): Promise<RuntimeTask | null> {
    const current = await this.read(context, input.id, input.scope, input.actor);
    if (!current) return null;
    current.assertCancellation(input.expectedVersion);
    const database = this.transactions.database(context);
    if (input.id.startsWith('job:')) {
      const changed = await database.query(`update runtime.jobs set state=case when state='queued' then 'cancelled' else state end,
        cancel_requested_at=clock_timestamp(),checkpoint=checkpoint||jsonb_build_object('cancelReason',$5::text),
        version=version+1,updated_by=$3,updated_at=clock_timestamp()
        where id=$1 and scope_id=$2 and created_by=$3 and version=$4 and state in('queued','running') and cancel_requested_at is null returning id`,
      [input.id, input.scope, input.actor, input.expectedVersion, input.reason]);
      this.assertChanged(changed.rowCount);
    } else if (input.id.startsWith('import:')) {
      await database.query(`update runtime.import_chunks set state='failed',lease_expires_at=null,
        checkpoint=checkpoint||jsonb_build_object('cancelled',true),version=version+1,updated_at=clock_timestamp()
        where import_id=$1 and state='running'`, [input.id]);
      const changed = await database.query(`update runtime.imports set state='cancelled',checkpoint=checkpoint||jsonb_build_object('cancelReason',$5::text),
        version=version+1,updated_by=$3,updated_at=clock_timestamp()
        where id=$1 and scope_id=$2 and created_by=$3 and version=$4 and state in('uploaded','scanning','preflight','ready','running') returning id`,
      [input.id, input.scope, input.actor, input.expectedVersion, input.reason]);
      this.assertChanged(changed.rowCount);
    } else if (input.id.startsWith('export:')) {
      const changed = await database.query(`update runtime.exports set state='cancelled',version=version+1,updated_by=$3,updated_at=clock_timestamp()
        where id=$1 and scope_id=$2 and created_by=$3 and version=$4 and state in('queued','running') returning id`,
      [input.id, input.scope, input.actor, input.expectedVersion]);
      this.assertChanged(changed.rowCount);
    } else throw new DomainError('RESOURCE_NOT_FOUND');
    return this.read(context, input.id, input.scope, input.actor);
  }

  async retryImport(context: WriteTransactionContext, input: TaskMutation): Promise<RuntimeTask | null> {
    if (!input.id.startsWith('import:')) return null;
    const current = await this.read(context, input.id, input.scope, input.actor);
    if (!current) return null;
    current.assertRetry(input.expectedVersion);
    const changed = await this.transactions.database(context).query(`with candidates as materialized(
        select chunk.id,chunk.state,chunk.row_start,chunk.row_end,chunk.checkpoint from runtime.import_chunks chunk
        where chunk.import_id=$1 and (chunk.state='failed' or exists(select 1 from runtime.import_errors failure
          where failure.import_id=chunk.import_id and failure.row_number between chunk.row_start and chunk.row_end))
      ),reset as(
        update runtime.import_chunks chunk set state='pending',fencing_token=null,lease_expires_at=null,checkpoint='{}'::jsonb,
          error_count=0,version=version+1,updated_at=clock_timestamp() from candidates where chunk.id=candidates.id returning chunk.id
      ),removed as(
        delete from runtime.import_errors failure using candidates where failure.import_id=$1
          and failure.row_number between candidates.row_start and candidates.row_end returning failure.row_number
      ) update runtime.imports target set
      state=case when exists(select 1 from runtime.import_chunks chunk where chunk.import_id=target.id) then 'ready' else 'uploaded' end,
      rows_processed=greatest(0,rows_processed-coalesce((select sum(row_end-row_start+1) from candidates where state='succeeded'),0)),
      rows_succeeded=greatest(0,rows_succeeded-coalesce((select sum(case when checkpoint->>'succeeded'~'^\d+$' then (checkpoint->>'succeeded')::bigint else 0 end) from candidates where state='succeeded'),0)),
      rows_failed=greatest(0,rows_failed-coalesce((select sum(case when checkpoint->>'failed'~'^\d+$' then (checkpoint->>'failed')::bigint else 0 end) from candidates where state='succeeded'),0)),
      error_report_key=null,checkpoint=(checkpoint-'code'-'lastError'-'reportSha256'-'reportSize')||jsonb_build_object(
        'retryReason',$5::text,'retriedAt',clock_timestamp(),'resetChunks',(select count(*) from reset),'removedErrors',(select count(*) from removed)),
      version=version+1,updated_by=$3,updated_at=clock_timestamp()
      where id=$1 and scope_id=$2 and created_by=$3 and version=$4 and state in('failed','rejected') returning id`,
    [input.id, input.scope, input.actor, input.expectedVersion, input.reason]);
    this.assertChanged(changed.rowCount);
    return this.read(context, input.id, input.scope, input.actor);
  }

  async confirmImport(context: WriteTransactionContext, input: TaskConfirmation): Promise<RuntimeTask | null> {
    if (!input.id.startsWith('import:') || !/^[a-f0-9]{64}$/.test(input.previewHash)) return null;
    const current = await this.read(context, input.id, input.scope, input.actor);
    if (!current) return null;
    const snapshot = current.snapshot();
    if (snapshot.type !== 'import' || snapshot.state !== 'ready' || !snapshot.confirmationRequired) throw new DomainError('VALIDATION_FAILED', { state: snapshot.state });
    if (snapshot.validationErrors > 0) throw new DomainError('VALIDATION_FAILED', { field: 'validationErrors' });
    if (snapshot.version !== input.expectedVersion) throw new DomainError('VERSION_CONFLICT');
    if (snapshot.previewHash !== input.previewHash) throw new DomainError('VERSION_CONFLICT');
    const changed = await this.transactions.database(context).query(
      `update runtime.imports set checkpoint=checkpoint||jsonb_build_object('confirmedAt',clock_timestamp(),'confirmedBy',$3::text,'confirmReason',$6::text),
       retention_until=greatest(retention_until,clock_timestamp()+interval '90 days'),version=version+1,updated_by=$3,updated_at=clock_timestamp()
       where id=$1 and scope_id=$2 and created_by=$3 and version=$4 and state='ready' and checkpoint->>'previewHash'=$5
         and not(checkpoint ? 'confirmedAt') and retention_until>clock_timestamp()
         and not exists(select 1 from runtime.import_errors failure where failure.import_id=runtime.imports.id) returning id`,
      [input.id, input.scope, input.actor, input.expectedVersion, input.previewHash, input.reason]
    );
    this.assertChanged(changed.rowCount);
    return this.read(context, input.id, input.scope, input.actor);
  }

  private task(row: TaskRow): RuntimeTask {
    const type = row.type;
    const common: Omit<RuntimeTaskData, 'type'> = Object.freeze({
      id: row.id,
      owner: row.owner,
      kind: row.kind,
      title: type === 'job' ? this.jobs.title(row.owner, row.kind) : type === 'import' ? this.imports.title(row.owner, row.kind) : this.exports.title(row.owner, row.kind),
      state: row.state,
      processed: Number(row.processed),
      total: Number(row.total),
      succeeded: Number(row.succeeded),
      failed: Number(row.failed),
      retryableItems: Number(row.retryableItems),
      version: Number(row.version),
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: new Date(row.updatedAt).toISOString(),
      expiresAt: row.expiresAt === null ? null : new Date(row.expiresAt).toISOString(),
      fileName: row.fileName,
      downloadAvailable: row.downloadAvailable,
      cancelRequested: row.cancelRequested,
      confirmationRequired: row.confirmationRequired,
      previewHash: row.previewHash,
      columns: Object.freeze([...row.columns]),
      validationErrors: Number(row.validationErrors),
    });
    if (type === 'job') return new Job(common);
    if (type === 'import') return new ImportTask(common);
    return new ExportTask(common);
  }

  private assertChanged(count: number | null): void {
    if (count !== 1) throw new DomainError('VERSION_CONFLICT');
  }
}
