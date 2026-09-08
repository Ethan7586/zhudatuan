import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import type { ImportFailure, ImportProgress, ImportTarget } from '../../public/ImportProcess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { ImportPort, RuntimeImportChunk, RuntimeImportCreated, RuntimeImportRecord, RuntimeStagedChunk } from '../../public/ImportPort';
import { IMPORT_CAPACITY } from '@shop/config/runtime';
import { PgImportEvidence } from './PgImportEvidence';
import { runtimeImportCreated, runtimeImportDigest, runtimeImportMetadata, runtimeImportRecord, type RuntimeImportRow } from './RuntimeImportValue';
export class PgRuntimeImportStore {
  protected readonly evidence: PgImportEvidence;
  constructor(protected readonly transactions = new PgTransactionAccess()) {
    this.evidence = new PgImportEvidence(transactions);
  }

  async create(context: WriteTransactionContext, input: Parameters<ImportPort['create']>[1]): Promise<RuntimeImportCreated> {
    const result = await this.transactions.database(context).query<RuntimeImportRow>(
      `with created as(insert into runtime.imports(id,tenant_id,scope_id,owner,kind,object_key,file_hash,file_name,media_type,size_bytes,authorization_snapshot,state,
       rows_total,rows_processed,rows_succeeded,rows_failed,checkpoint,error_report_key,idempotency_key,version,created_by,updated_by,
       created_at,updated_at,retention_until) values($1,$2,$2,$3,$4,$5,$6,$7,$8,$9,$11::jsonb,'uploaded',null,0,0,0,jsonb_build_object('metadata',$12::jsonb),null,$1,1,$10,$10,
       clock_timestamp(),clock_timestamp(),clock_timestamp()+interval '24 hours') returning *)
       select id,state,0::integer total_count,0::integer cursor_value,0::integer success_count,0::integer failure_count,
       created_at,updated_at,'{}'::jsonb validation_summary,null::text last_error,'[]'::jsonb errors,
       null::text report_object_ref,null::text report_sha256,null::bigint report_size,scope_id,owner,object_key,file_hash from created`,
      [input.id, input.scope, input.owner, input.kind, input.reference, input.sha256, input.name, input.mediaType, input.size, input.actor, JSON.stringify(input.authorization), JSON.stringify(input.metadata ?? {})]
    );
    const row = result.rows[0];
    if (!row) throw new Error('RUNTIME_IMPORT_CREATE_FAILED');
    return runtimeImportCreated(row);
  }

  async read(context: ReadTransactionContext, id: string, scope: string, owner: string): Promise<RuntimeImportRecord | null> {
    const result = await this.transactions.database(context).query<RuntimeImportRow>(
      `select target.id,case when target.state='succeeded' then 'completed' when target.state in('preflight','scanning') then 'validating' else target.state end state,
       coalesce(target.rows_total,0)::integer total_count,target.rows_processed::integer cursor_value,target.rows_succeeded::integer success_count,
       target.rows_failed::integer failure_count,target.checkpoint validation_summary,target.checkpoint->>'lastError' last_error,
       target.error_report_key report_object_ref,target.checkpoint->>'reportSha256' report_sha256,
       nullif(target.checkpoint->>'reportSize','')::bigint report_size,target.created_at,target.updated_at,
       coalesce((select jsonb_agg(jsonb_build_object('row_number',failure.row_number,'reason_code',failure.reason_code,'field',failure.field,'detail',failure.detail)
         order by failure.row_number,failure.reason_code) from runtime.import_errors failure where failure.import_id=target.id),'[]'::jsonb) errors,
       target.scope_id,target.owner,target.object_key,target.file_hash
       from runtime.imports target where target.id=$1 and target.scope_id=$2 and target.owner=$3`,
      [id, scope, owner]
    );
    return result.rows[0] ? runtimeImportRecord(result.rows[0]) : null;
  }

  async find(context: ReadTransactionContext, id: string, owner: string): Promise<ImportTarget | null> {
    const result = await this.transactions.database(context).query<RuntimeImportRow>(
      `select id,scope_id,owner,object_key,file_hash,state,checkpoint,authorization_snapshot,null::text report_object_ref,null::text report_sha256,null::bigint report_size
       from runtime.imports where id=$1 and owner=$2`,
      [id, owner]
    );
    const row = result.rows[0];
    return row
      ? Object.freeze({
          id: row.id,
          scope: row.scope_id,
          reference: row.object_key,
          sha256: row.file_hash,
          state: runtimeImportCreated(row).state,
          authorization: Object.freeze({ ...(row.authorization_snapshot ?? {}) }),
          metadata: runtimeImportMetadata(row.checkpoint),
          confirmed: typeof row.checkpoint?.confirmedAt === 'string',
        })
      : null;
  }

  async begin(context: WriteTransactionContext, id: string, owner: string) {
    const database = this.transactions.database(context);
    const started = await database.query(
      `update runtime.imports set state='preflight',
      checkpoint=jsonb_build_object('metadata',coalesce(checkpoint->'metadata','{}'::jsonb)),version=version+1,
      updated_at=clock_timestamp(),updated_by='job:import' where id=$1 and scope_id=$2 and owner=$3 and state in('uploaded','preflight') returning id`,
      [id, context.scope, owner]
    );
    if (started.rows.length !== 1) throw new Error('RUNTIME_IMPORT_STAGE_CONFLICT');
    const summary = await database.query<{ chunks: number; staged: number; minimum: number | null; maximum: number | null; last: number | null; invalid: boolean }>(
      `with ordered as(select sequence,row_start,row_end,lag(row_end) over(order by sequence) previous,
         row_number() over(order by sequence)-1 ordinal from runtime.import_chunks where import_id=$1)
       select count(*)::integer chunks,coalesce(sum(row_end-row_start+1),0)::integer staged,min(sequence)::integer minimum,
       max(sequence)::integer maximum,max(row_end)::integer last,
       coalesce(bool_or(sequence<>ordinal or row_end<row_start or row_end-row_start+1>$2
         or sequence=0 and row_start<>2 or sequence>0 and row_start<>previous+1),false) invalid from ordered`,
      [id, IMPORT_CAPACITY.chunkRows]
    );
    const row = summary.rows[0];
    if (!row) throw new Error('RUNTIME_IMPORT_STAGE_CONFLICT');
    const chunks = Number(row.chunks);
    const staged = Number(row.staged);
    if (row.invalid || chunks < 0 || staged < 0 || (chunks > 0 && (Number(row.minimum) !== 0 || Number(row.maximum) !== chunks - 1 || Number(row.last) !== staged + 1))) {
      throw new Error('RUNTIME_IMPORT_STAGE_CONFLICT');
    }
    return Object.freeze({ sequence: chunks, staged });
  }

  async stage(context: WriteTransactionContext, id: string, owner: string, chunks: readonly RuntimeStagedChunk[], failures: readonly ImportFailure[] = []): Promise<void> {
    if (chunks.length === 0) return;
    const values = chunks.map((chunk) => ({
      id: `importchunk:${id.slice('import:'.length)}:${chunk.sequence}`,
      sequence: chunk.sequence,
      rowStart: chunk.rows[0]!.row,
      rowEnd: chunk.rows.at(-1)!.row,
      payloadHash: runtimeImportDigest(chunk.rows),
      payload: chunk.rows,
    }));
    await this.transactions.database(context).query(
      `insert into runtime.import_chunks(id,tenant_id,scope_id,import_id,sequence,row_start,row_end,payload_hash,payload,state,
       fencing_token,checkpoint,error_count,version,created_at,updated_at)
       select item.id,$2,$2,$1,item.sequence,item."rowStart",item."rowEnd",item."payloadHash",item.payload,'pending',null,'{}'::jsonb,0,1,
       clock_timestamp(),clock_timestamp() from runtime.imports target cross join
       jsonb_to_recordset($4::jsonb) item(id text,sequence integer,"rowStart" bigint,"rowEnd" bigint,"payloadHash" text,payload jsonb)
       where target.id=$1 and target.scope_id=$2 and target.owner=$3 and target.state='preflight' on conflict(import_id,sequence) do nothing`,
      [id, context.scope, owner, JSON.stringify(values)]
    );
    const accepted = await this.transactions.database(context).query<{ sequence: number; rowStart: number; rowEnd: number }>(
      `select chunk.sequence,chunk.row_start::integer "rowStart",chunk.row_end::integer "rowEnd" from runtime.import_chunks chunk
       join runtime.imports target on target.id=chunk.import_id where chunk.import_id=$1 and target.scope_id=$2 and target.owner=$3
       and chunk.sequence=any($4::integer[]) order by chunk.sequence`,
      [id, context.scope, owner, values.map(({ sequence }) => sequence)]
    );
    if (accepted.rows.length !== values.length || accepted.rows.some((row, index) => row.sequence !== values[index]!.sequence || Number(row.rowStart) !== values[index]!.rowStart || Number(row.rowEnd) !== values[index]!.rowEnd))
      throw new Error('RUNTIME_IMPORT_STAGE_CONFLICT');
    if (failures.length > 0) await this.evidence.store(context, id, owner, failures);
  }

  async ready(context: WriteTransactionContext, id: string, owner: string, total: number, columns: readonly string[]): Promise<void> {
    const result = await this.transactions.database(context).query(
      `with ordered as(select sequence,row_start,row_end,state,lag(row_end) over(order by sequence) previous,
         row_number() over(order by sequence)-1 ordinal from runtime.import_chunks where import_id=$1),
       staged as(select count(*)::integer chunks,coalesce(sum(row_end-row_start+1),0)::integer rows,
         min(row_start)::integer first,max(row_end)::integer last,bool_and(state='pending') pending,
         bool_and(sequence=ordinal and row_end>=row_start and row_end-row_start+1<=$4
           and (sequence=0 and row_start=2 or sequence>0 and row_start=previous+1)) contiguous from ordered)
       update runtime.imports target set state='ready',rows_total=$2,rows_processed=0,rows_succeeded=0,rows_failed=0,
       checkpoint=checkpoint||jsonb_build_object('format',target.media_type,'columns',$3::jsonb,'chunkSize',$4::integer,'chunkStrategy','adaptive',
         'previewHash',encode(public.digest(target.file_hash||':'||$2::text||':'||$3::text||':'||
           coalesce((select string_agg(chunk.payload_hash,',' order by chunk.sequence) from runtime.import_chunks chunk where chunk.import_id=target.id),''),'sha256'),'hex')),
       retention_until=least(retention_until,clock_timestamp()+interval '24 hours'),version=version+1,
       updated_at=clock_timestamp(),updated_by='job:import' from staged where target.id=$1 and target.scope_id=$5 and target.owner=$6 and target.state='preflight'
       and staged.chunks>0 and staged.rows=$2 and staged.first=2 and staged.last=$2+1 and staged.pending and staged.contiguous`,
      [id, total, JSON.stringify(columns), IMPORT_CAPACITY.chunkRows, context.scope, owner]
    );
    if (result.rowCount !== 1) throw new Error('RUNTIME_IMPORT_STAGE_CONFLICT');
  }
}
