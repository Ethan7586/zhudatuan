import { randomUUID } from 'node:crypto';
import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { JobPort, RuntimeJobRecord } from '../../public/JobPort';
import { jobDefinition, type JobKind } from '../../../../foundation/application/JobCatalog';
import { QueueAdmission } from '../queue/QueueAdmission';

interface Row { readonly id: string; readonly kind: string; readonly state: string; readonly checkpoint: Readonly<Record<string, unknown>>; readonly updatedAt: Date | string; }
export class PgJobPort implements JobPort {
  constructor(private readonly transactions = new PgTransactionAccess()) {}
  async create(context: WriteTransactionContext, input: Parameters<JobPort['create']>[1]): Promise<RuntimeJobRecord> {
    const definition = jobDefinition(input.kind as JobKind);
    if (definition.owner !== input.owner || definition.queue !== input.queue) throw new Error('RUNTIME_JOB_DEFINITION_MISMATCH');
    const id = `job:${randomUUID()}`;
    const database = this.transactions.database(context);
    await new QueueAdmission(database).assert({ id, queue: definition.queue, priority: 100 });
    const result = await database.query<Row>(
      `insert into runtime.jobs(id,tenant_id,scope_id,kind,owner,queue,payload,state,priority,available_at,checkpoint,progress,idempotency_key,retention_until,version,created_by,updated_by,created_at,updated_at)
       values($1,$2,$2,$3,$4,$5,$6::jsonb,'queued',100,clock_timestamp(),'{}',0,$7,clock_timestamp()+interval '90 days',1,$8,$8,clock_timestamp(),clock_timestamp())
       on conflict(scope_id,owner,idempotency_key) do update set updated_at=runtime.jobs.updated_at returning id,kind,state,checkpoint,updated_at as "updatedAt"`,
      [id, input.scope, input.kind, input.owner, input.queue, JSON.stringify(input.payload), `${input.kind}:${input.idempotency}`, input.actor]
    );
    return projection(result.rows[0]!);
  }
  async read(context: ReadTransactionContext, id: string, scope: string, owner: string): Promise<RuntimeJobRecord | null> {
    const result = await this.transactions.database(context).query<Row>(`select id,kind,state,checkpoint,updated_at as "updatedAt" from runtime.jobs where id=$1 and scope_id=$2 and owner=$3`, [id, scope, owner]);
    return result.rows[0] ? projection(result.rows[0]) : null;
  }
  async find(context: ReadTransactionContext, scope: string, owner: string, kind: string, idempotency: string): Promise<RuntimeJobRecord | null> {
    const result = await this.transactions.database(context).query<Row>(
      `select id,kind,state,checkpoint,updated_at as "updatedAt" from runtime.jobs where scope_id=$1 and owner=$2 and idempotency_key=$3`,
      [scope, owner, `${kind}:${idempotency}`]
    );
    return result.rows[0] ? projection(result.rows[0]) : null;
  }
  async progress(context: WriteTransactionContext, id: string, scope: string, owner: string, checkpoint: Readonly<Record<string, number>>): Promise<RuntimeJobRecord> {
    const total = positive(checkpoint.total, 'RUNTIME_JOB_TOTAL_INVALID');
    const processed = nonnegative(checkpoint.processed, 'RUNTIME_JOB_PROCESSED_INVALID');
    const succeeded = nonnegative(checkpoint.succeeded, 'RUNTIME_JOB_SUCCEEDED_INVALID');
    const failed = nonnegative(checkpoint.failed, 'RUNTIME_JOB_FAILED_INVALID');
    const retryable = nonnegative(checkpoint.retryable, 'RUNTIME_JOB_RETRYABLE_INVALID');
    if (processed !== succeeded + failed || processed > total || retryable > failed) throw new Error('RUNTIME_JOB_PROGRESS_INVALID');
    const progress = Math.min(99, Math.floor((processed * 100) / total));
    const result = await this.transactions.database(context).query<Row>(
      `update runtime.jobs set checkpoint=checkpoint||$4::jsonb,progress=$5,version=version+1,updated_by=$6,updated_at=clock_timestamp()
       where id=$1 and scope_id=$2 and owner=$3 and state in('queued','running')
       returning id,kind,state,checkpoint,updated_at as "updatedAt"`,
      [id, scope, owner, JSON.stringify({ total, processed, succeeded, failed, retryable }), progress, context.actor]
    );
    if (!result.rows[0]) throw new Error('RUNTIME_JOB_PROGRESS_CONFLICT');
    return projection(result.rows[0]);
  }
}
function projection(row: Row): RuntimeJobRecord {
  const value = (key: string) => Number(row.checkpoint[key] ?? 0);
  const state = row.state === 'succeeded' ? 'completed' : row.state === 'deadlettered' ? 'failed' : row.state as RuntimeJobRecord['state'];
  return Object.freeze({ id: row.id, kind: row.kind, state, processed: value('processed'), total: value('total'), succeeded: value('succeeded'), failed: value('failed'), retryable: value('retryable'), updatedAt: new Date(row.updatedAt).toISOString() });
}
function nonnegative(value: number | undefined, code: string): number { if (!Number.isSafeInteger(value) || (value ?? -1) < 0) throw new Error(code); return value!; }
function positive(value: number | undefined, code: string): number { const result = nonnegative(value, code); if (result < 1) throw new Error(code); return result; }
