import type { JobScheduler, ScheduledJob } from '../../foundation/application/JobScheduler';
import type { WriteTransactionContext } from '../../foundation/persistence/TransactionContext';
import { PgTransactionAccess } from './PgTransactionAccess';
import { jobDefinition, type JobKind } from '../../foundation/application/JobCatalog';
import { QueueAdmission } from '../../modules/runtime/infrastructure/queue/QueueAdmission';

export class PgJobScheduler implements JobScheduler {
  constructor(private readonly transactions: PgTransactionAccess) {}

  async schedule(context: WriteTransactionContext, job: ScheduledJob): Promise<void> {
    if (!job.id || !job.kind || !job.owner || !job.scope || !Number.isSafeInteger(job.priority)) throw new Error('JOB_SCHEDULE_INVALID');
    const definition = jobDefinition(job.kind as JobKind);
    const database = this.transactions.database(context);
    await new QueueAdmission(database).assert({ id: job.id, queue: definition.queue, priority: job.priority });
    await database.query(
      `insert into runtime.jobs(id,tenant_id,scope_id,kind,owner,queue,payload,state,priority,available_at,checkpoint,progress,
       idempotency_key,retention_until,version,created_by,updated_by,created_at,updated_at)
      values($1,$4,$4,$2,$3,$8,$5::jsonb,'queued',$6,coalesce($7::timestamptz,clock_timestamp()),'{}',0,
       $1,clock_timestamp()+interval '90 days',1,$9,$9,clock_timestamp(),clock_timestamp())
      on conflict(id) do nothing`,
      [job.id, job.kind, definition.owner, job.scope, JSON.stringify(job.payload), job.priority, job.availableAt ?? null, definition.queue, context.actor]
    );
  }

  async cancel(context: WriteTransactionContext, kind: string, resource: string): Promise<void> {
    if (!kind || !resource) throw new Error('JOB_CANCEL_INVALID');
    await this.transactions.database(context).query(
      `update runtime.jobs set state='cancelled',cancel_requested_at=clock_timestamp(),version=version+1,
       updated_by=$3,updated_at=clock_timestamp() where kind=$1 and payload->>'run'=$2 and state='queued'`,
      [kind, resource, context.actor]
    );
  }
}
