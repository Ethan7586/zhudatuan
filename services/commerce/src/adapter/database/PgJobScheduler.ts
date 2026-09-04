import type { JobScheduler, ScheduledJob } from '../../foundation/application/JobScheduler';
import type { WriteTransactionContext } from '../../foundation/persistence/TransactionContext';
import { PgTransactionAccess } from './PgTransactionAccess';

export class PgJobScheduler implements JobScheduler {
  constructor(private readonly transactions: PgTransactionAccess) {}

  async schedule(context: WriteTransactionContext, job: ScheduledJob): Promise<void> {
    if (!job.id || !job.kind || !job.owner || !job.scope || !Number.isSafeInteger(job.priority)) throw new Error('JOB_SCHEDULE_INVALID');
    await this.transactions.database(context).query(
      `insert into runtime.job(id,kind,owner,scope_id,payload,state,priority,available_at,created_at,updated_at)
      values($1,$2,$3,$4,$5::jsonb,'queued',$6,coalesce($7::timestamptz,clock_timestamp()),clock_timestamp(),clock_timestamp())
      on conflict(id) do nothing`,
      [job.id, job.kind, job.owner, job.scope, JSON.stringify(job.payload), job.priority, job.availableAt ?? null]
    );
  }

  async cancel(context: WriteTransactionContext, kind: string, resource: string): Promise<void> {
    if (!kind || !resource) throw new Error('JOB_CANCEL_INVALID');
    await this.transactions.database(context).query(
      `update runtime.job set state='cancelled',updated_at=clock_timestamp()
      where kind=$1 and payload->>'run'=$2 and state='queued'`,
      [kind, resource]
    );
  }
}
