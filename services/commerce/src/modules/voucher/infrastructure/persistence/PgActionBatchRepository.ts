import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { ExportPort, JobPort } from '../../../runtime/public';
import type { ActionBatchRepository } from '../../application/port/ActionBatchRepository';
import { ActionBatch } from '../../domain/model/ActionBatch';
import { createVoucherExport } from './PgVoucherExport';
import { ACTION, ACTION_BATCH_FIELDS, body, cursor, entity, expected, limit, one, optionalText, page, path, query, requiredIdempotency, text, write } from './VoucherSupport';

export class PgActionBatchRepository implements ActionBatchRepository {
  constructor(private readonly jobs: JobPort, private readonly exports: ExportPort, private readonly transactions = new PgTransactionAccess()) {}
  async create(call: Parameters<ActionBatchRepository['create']>[0]) {
    const database = this.transactions.database(call.context.transaction); const value = body(call); const snapshot = text(value.snapshot, 'snapshot');
    const action = actionValue(value.action); const selected = await database.query<{ result_count: number }>(`select result_count from voucher.searchsnapshot where id=$1 and scope_id=$2 and expires_at>clock_timestamp() for update`, [snapshot, call.scope]);
    const count = Number(selected.rows[0]?.result_count ?? 0); if (count <= 0) throw new DomainError(selected.rows[0] ? 'VALIDATION_FAILED' : 'RESOURCE_NOT_FOUND');
    const id = entity('actionbatch');
    await database.query(`insert into voucher.actionbatch(id,scope_id,snapshot_id,action,reason,expires_at,state,requested,processed,succeeded,failed,retryable,version,created_by,created_at,updated_at)
      values($1,$2,$3,$4,$5,$6,'queued',$7,0,0,0,0,1,$8,$9,$9)`, [id, call.scope, snapshot, action, text(value.reason, 'reason'), value.expiresAt ?? null, count, call.actor, call.now]);
    await database.query(`insert into voucher.actionitem(batch_id,scope_id,voucher_id,state,previous_state,next_state,error_code,retryable,idempotency_key,updated_at)
      select $1,$2,item.voucher_id,'queued',null,null,null,false,$1||':'||item.voucher_id,$3 from voucher.searchsnapshotitem item where item.snapshot_id=$4 and item.scope_id=$2`, [id, call.scope, call.now, snapshot]);
    await this.jobs.create(write(call), { scope: call.scope, owner: 'voucher', kind: 'voucheraction', queue: 'batch', payload: { batch: id }, idempotency: requiredIdempotency(call), actor: call.actor });
    return one<'voucher.actionbatches.create'>(202, (await database.query(`${ACTION} where batch.id=$1 and batch.scope_id=$2`, [id, call.scope])).rows[0]);
  }
  async get(call: Parameters<ActionBatchRepository['get']>[0]) { const row = await this.transactions.database(call.context.transaction).query(`${ACTION} where batch.id=$1 and batch.scope_id=$2`, [path(call, 'batchid'), call.scope]); return one<'voucher.actionbatches.get'>(200, row.rows[0]); }
  async list(call: Parameters<ActionBatchRepository['list']>[0]) { const database = this.transactions.database(call.context.transaction); const filter = query(call); const fetch = limit(filter.limit); const rows = await database.query(`${ACTION} where batch.scope_id=$1 and ($2::text is null or batch.state=$2) and ($3::text is null or batch.action=$3) and ($4::text is null or batch.id>$4) order by batch.id limit $5`, [call.scope, optionalText(filter.state), optionalText(filter.action), cursor(filter.cursor), fetch + 1]); return page<'voucher.actionbatches.list'>(rows.rows, fetch); }
  async retry(call: Parameters<ActionBatchRepository['retry']>[0]) {
    const database = this.transactions.database(call.context.transaction); const id = path(call, 'batchid'); const selected = await database.query<BatchRow>(`select ${ACTION_BATCH_FIELDS} from voucher.actionbatch batch where batch.id=$1 and batch.scope_id=$2 for update`, [id, call.scope]); const row = selected.rows[0];
    if (!row) throw new DomainError('RESOURCE_NOT_FOUND'); if (row.version !== expected(call)) throw new DomainError('VERSION_CONFLICT'); const retried = new ActionBatch({ id: row.id, snapshot: row.snapshot_id, action: row.action, state: row.state, requested: row.requested, processed: row.processed, succeeded: row.succeeded, failed: row.failed, retryable: row.retryable, version: row.version }).retry();
    await database.query(`update voucher.actionbatch set state='queued',processed=$3,failed=$4,retryable=0,version=$5 where id=$1 and scope_id=$2`, [id, call.scope, retried.value.processed, retried.value.failed, retried.value.version]);
    await database.query(`update voucher.actionitem set state='queued',error_code=null,retryable=false,updated_at=clock_timestamp() where batch_id=$1 and retryable`, [id]);
    await this.jobs.create(write(call), { scope: call.scope, owner: 'voucher', kind: 'voucheraction', queue: 'batch', payload: { batch: id }, idempotency: requiredIdempotency(call), actor: call.actor });
    return one<'voucher.actionbatches.retry'>(202, (await database.query(`${ACTION} where batch.id=$1 and batch.scope_id=$2`, [id, call.scope])).rows[0]);
  }
  async export(call: Parameters<ActionBatchRepository['export']>[0]) {
    const database = this.transactions.database(call.context.transaction); const batch = text(body(call).batch, 'batch');
    if (!(await database.query(`select id from voucher.actionbatch where id=$1 and scope_id=$2`, [batch, call.scope])).rows[0]) throw new DomainError('RESOURCE_NOT_FOUND');
    const result = await createVoucherExport(call, { kind: 'action', snapshot: { batch } }, { database, exports: this.exports, jobs: this.jobs });
    return { status: 202, body: result };
  }
}
interface BatchRow { readonly id: string; readonly snapshot_id: string; readonly action: 'activate' | 'disable' | 'enable' | 'void' | 'extend'; readonly state: 'queued' | 'running' | 'completed' | 'failed'; readonly requested: number; readonly processed: number; readonly succeeded: number; readonly failed: number; readonly retryable: number; readonly version: number; }
function actionValue(value: unknown): BatchRow['action'] { if (!['activate','disable','enable','void','extend'].includes(String(value))) throw new DomainError('VALIDATION_FAILED', { field: 'action' }); return value as BatchRow['action']; }
