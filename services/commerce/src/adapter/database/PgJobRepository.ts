import type { JobRepository, ClaimedJob } from '../../foundation/application/JobRunner';
import type { WriteTransactionContext } from '../../foundation/persistence/TransactionContext';
import { PgTransactionAccess } from './PgTransactionAccess';

export class PgJobRepository implements JobRepository {
  constructor(private readonly transactions = new PgTransactionAccess()) {}

  async claim(context: WriteTransactionContext, kind: string, worker: string, batch: number, lease: number, workload: string): Promise<readonly ClaimedJob[]> {
    const result = await this.transactions.database(context).query<ClaimedJob>('select id,kind,scope_id,payload,attempts,fencing_token from runtime.claim_job($1,$2,$3,$4,$5)', [kind, worker, batch, lease, workload]);
    return Object.freeze(result.rows.map((job) => Object.freeze(job)));
  }

  async complete(context: WriteTransactionContext, job: ClaimedJob, worker: string): Promise<void> {
    const result = await this.transactions.database(context).query(
      `update runtime.job set state='completed',lease_owner=null,lease_deadline=null,updated_at=clock_timestamp()
      where id=$1 and state='running' and lease_owner=$2 and fencing_token=$3`,
      [job.id, worker, job.fencing_token]
    );
    if (result.rowCount !== 1) throw new Error('JOB_LEASE_LOST');
  }

  async heartbeat(context: WriteTransactionContext, job: ClaimedJob, worker: string, lease: number): Promise<void> {
    const result = await this.transactions.database(context).query(
      `update runtime.job set lease_deadline=clock_timestamp()+make_interval(secs=>$3),updated_at=clock_timestamp()
      where id=$1 and state='running' and lease_owner=$2 and fencing_token=$4`,
      [job.id, worker, lease, job.fencing_token]
    );
    if (result.rowCount !== 1) throw new Error('JOB_LEASE_LOST');
  }

  async fail(context: WriteTransactionContext, job: ClaimedJob, worker: string, terminal: boolean, delay: number): Promise<void> {
    const result = await this.transactions.database(context).query(
      `update runtime.job set state=$3,lease_owner=null,lease_deadline=null,
      available_at=case when $3='queued' then clock_timestamp()+make_interval(secs=>$4::double precision/1000) else available_at end,
      updated_at=clock_timestamp() where id=$1 and state='running' and lease_owner=$2 and fencing_token=$5`,
      [job.id, worker, terminal ? 'failed' : 'queued', delay, job.fencing_token]
    );
    if (result.rowCount !== 1) throw new Error('JOB_LEASE_LOST');
  }
}
