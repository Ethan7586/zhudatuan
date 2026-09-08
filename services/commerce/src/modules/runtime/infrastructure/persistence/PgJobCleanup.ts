import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { CleanupEvidence, JobCleanup } from '../../application/port/CleanupPort';
import { cleanupIds, cleanupLimit } from './PgCleanupValue';

export class PgJobCleanup implements JobCleanup {
  constructor(private readonly transactions = new PgTransactionAccess()) {}

  async recover(context: WriteTransactionContext, currentJobId: string, limit: number): Promise<void> {
    if (!currentJobId.startsWith('job:')) throw new Error('CLEANUP_JOB_ID_INVALID');
    cleanupLimit(limit);
    await this.transactions.database(context).query(
      `with candidates as(
         select id from runtime.jobs where state='running' and lease_deadline<clock_timestamp() and id<>$1
         order by lease_deadline,id limit $2 for update skip locked
       ), released as(update runtime.jobs set state=case when cancel_requested_at is null then 'queued' else 'cancelled' end,
       lease_owner=null,lease_deadline=null,version=version+1,updated_by='job:cleanup',updated_at=clock_timestamp()
       from candidates where jobs.id=candidates.id returning jobs.id,jobs.attempts,jobs.cancel_requested_at)
       update runtime.job_attempts attempt set state=case when released.cancel_requested_at is null then 'failed' else 'cancelled' end,
       error_code=case when released.cancel_requested_at is null then 'JOB_LEASE_EXPIRED' else null end,finished_at=clock_timestamp()
       from released where attempt.job_id=released.id and attempt.attempt=released.attempts and attempt.state='running'`,
      [currentJobId, limit]
    );
  }

  async plan(context: ReadTransactionContext, limit: number): Promise<readonly string[]> {
    cleanupLimit(limit);
    const result = await this.transactions.database(context).query<{ id: string }>(
      `select id from runtime.jobs where state in('succeeded','failed','cancelled','deadlettered')
       and retention_until<clock_timestamp()
       and not exists(select 1 from runtime.deadletters where retry_job_id=runtime.jobs.id)
       order by retention_until,id limit $1`,
      [limit]
    );
    return cleanupIds(
      result.rows.map(({ id }) => id),
      'job:'
    );
  }

  async record(context: WriteTransactionContext, job: Readonly<{ id: string; token: number }>, evidence: CleanupEvidence): Promise<void> {
    if (
      !job.id.startsWith('job:') ||
      !Number.isSafeInteger(job.token) ||
      job.token < 1 ||
      !/^[a-f0-9]{64}$/.test(evidence.hash) ||
      !Number.isFinite(Date.parse(evidence.createdAt)) ||
      !Number.isFinite(Date.parse(evidence.inboxBefore)) ||
      !Number.isFinite(Date.parse(evidence.outboxBefore)) ||
      Object.values(evidence.counts).some((count) => !Number.isSafeInteger(count) || count < 0)
    )
      throw new Error('CLEANUP_EVIDENCE_INVALID');
    const result = await this.transactions.database(context).query(
      `update runtime.jobs set checkpoint=checkpoint||jsonb_build_object('cleanup',$3::jsonb),version=version+1,
       updated_by=$4,updated_at=clock_timestamp() where id=$1 and state='running' and fencing_token=$2
       and lease_deadline>clock_timestamp() and cancel_requested_at is null returning id`,
      [job.id, job.token, JSON.stringify(evidence), context.actor]
    );
    if (result.rowCount !== 1) throw new Error('JOB_LEASE_LOST');
  }

  async purge(context: WriteTransactionContext, ids: readonly string[]): Promise<number> {
    const planned = cleanupIds(ids, 'job:');
    if (planned.length === 0) return 0;
    const result = await this.transactions.database(context).query(
      `with candidates as materialized(
         select id from runtime.jobs where id=any($1::text[]) and state in('succeeded','failed','cancelled','deadlettered')
         and retention_until<clock_timestamp()
         and not exists(select 1 from runtime.deadletters where retry_job_id=runtime.jobs.id)
       ), attempts as(delete from runtime.job_attempts using candidates where job_attempts.job_id=candidates.id)
       delete from runtime.jobs using candidates where jobs.id=candidates.id returning jobs.id`,
      [planned]
    );
    return result.rows.length;
  }
}
