import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { ClaimedJob, JobClaim, JobQueuePort } from '../../public/JobProcess';
import type { ObservabilityMetricPort } from '../../../observability/public';

interface ClaimedJobRow {
  readonly id: string;
  readonly kind: string;
  readonly scope_id: string | null;
  readonly payload: unknown;
  readonly authorization_snapshot: Readonly<Record<string, unknown>>;
  readonly attempts: number;
  readonly fencing_token: number;
}

/** PostgreSQL queue adapter. Claim serialization makes concurrency limits global across worker replicas. */
export class PgJobQueue implements JobQueuePort {
  constructor(
    private readonly transactions = new PgTransactionAccess(),
    private readonly metrics?: ObservabilityMetricPort
  ) {}

  async claim(context: WriteTransactionContext, request: JobClaim): Promise<readonly ClaimedJob[]> {
    validateClaim(request);
    const database = this.transactions.database(context);
    await database.query('select pg_advisory_xact_lock(hashtextextended($1,0))', [`runtime:jobgroup:${request.kind}`]);
    const capacity = await database.query<{ active: number; queued: number }>(
      `select count(*) filter(where state='running' and lease_deadline>clock_timestamp())::integer active,
       count(*) filter(where state='queued' and available_at<=clock_timestamp())::integer queued
       from runtime.jobs where kind=$1 and queue=$2`,
      [request.kind, request.queue]
    );
    const active = Number(capacity.rows[0]?.active);
    const queued = Number(capacity.rows[0]?.queued);
    if (!Number.isSafeInteger(active) || active < 0 || !Number.isSafeInteger(queued) || queued < 0) throw new Error('JOB_QUEUE_CAPACITY_INVALID');
    this.metrics?.count('commerce.queue.depth', queued, {
      requestId: context.id,
      traceId: context.trace,
      actorId: context.actor,
      tenantId: context.tenant,
      scopeId: context.scope,
      module: 'runtime',
      operation: context.operation,
      job: request.kind,
      queue: request.queue,
      result: queued === 0 ? 'idle' : 'active',
    });
    const limit = Math.min(request.batch, Math.max(0, request.concurrency - active));
    if (limit === 0) return Object.freeze([]);
    const result = await database.query<ClaimedJobRow>('select id,kind,scope_id,payload,authorization_snapshot,attempts,fencing_token from runtime.claim_job($1,$2,$3,$4,$5)', [
      request.kind,
      request.worker,
      limit,
      request.lease,
      request.workload,
    ]);
    if (result.rows.length > limit) throw new Error('JOB_QUEUE_CLAIM_OVERFLOW');
    return Object.freeze(result.rows.map((row) => claimedJob(row, request.kind)));
  }

  async complete(context: WriteTransactionContext, job: ClaimedJob, worker: string): Promise<void> {
    const result = await this.transactions.database(context).query(
      `with completed as(update runtime.jobs set state='succeeded',progress=100,lease_owner=null,lease_deadline=null,
       version=version+1,updated_by=$2,updated_at=clock_timestamp()
       where id=$1 and state='running' and lease_owner=$2 and fencing_token=$3 and lease_deadline>clock_timestamp()
       and cancel_requested_at is null returning id,attempts)
       update runtime.job_attempts attempt set state='succeeded',finished_at=clock_timestamp()
       from completed where attempt.job_id=completed.id and attempt.attempt=completed.attempts and attempt.state='running' returning attempt.id`,
      [job.id, worker, job.token]
    );
    if (result.rowCount !== 1) throw new Error('JOB_LEASE_LOST');
  }

  async heartbeat(context: WriteTransactionContext, job: ClaimedJob, worker: string, lease: number): Promise<boolean> {
    validateLeaseSeconds(lease);
    const database = this.transactions.database(context);
    const result = await database.query(
      `update runtime.jobs set lease_deadline=clock_timestamp()+make_interval(secs=>$3),version=version+1,
       updated_by=$2,updated_at=clock_timestamp() where id=$1 and state='running' and lease_owner=$2 and fencing_token=$4
       and lease_deadline>clock_timestamp() and cancel_requested_at is null returning id`,
      [job.id, worker, lease, job.token]
    );
    if (result.rowCount === 1) return true;
    const cancelled = await database.query(
      `with changed as(update runtime.jobs set state='cancelled',lease_owner=null,lease_deadline=null,version=version+1,
       updated_by=$2,updated_at=clock_timestamp() where id=$1 and state='running' and lease_owner=$2 and fencing_token=$3
       and lease_deadline>clock_timestamp() and cancel_requested_at is not null returning id,attempts)
       update runtime.job_attempts attempt set state='cancelled',finished_at=clock_timestamp()
       from changed where attempt.job_id=changed.id and attempt.attempt=changed.attempts and attempt.state='running' returning attempt.id`,
      [job.id, worker, job.token]
    );
    if (cancelled.rowCount === 1) return false;
    throw new Error('JOB_LEASE_LOST');
  }

  async rejectAuthorization(context: WriteTransactionContext, job: ClaimedJob, worker: string): Promise<void> {
    const result = await this.transactions.database(context).query(
      `with changed as(update runtime.jobs set state='cancelled',lease_owner=null,lease_deadline=null,cancel_requested_at=clock_timestamp(),
       checkpoint=checkpoint||jsonb_build_object('errorCode','AUTHORIZATION_DENIED'),version=version+1,updated_by=$2,updated_at=clock_timestamp()
       where id=$1 and state='running' and lease_owner=$2 and fencing_token=$3 and lease_deadline>clock_timestamp() returning id,attempts)
       update runtime.job_attempts attempt set state='cancelled',error_code='AUTHORIZATION_DENIED',finished_at=clock_timestamp()
       from changed where attempt.job_id=changed.id and attempt.attempt=changed.attempts and attempt.state='running' returning attempt.id`,
      [job.id, worker, job.token]
    );
    if (result.rowCount !== 1) throw new Error('JOB_LEASE_LOST');
  }

  async fail(context: WriteTransactionContext, job: ClaimedJob, worker: string, terminal: boolean, delay: number, error: string): Promise<void> {
    if (!Number.isSafeInteger(delay) || delay < 0 || delay > 86_400_000 || !/^[A-Z][A-Z0-9_]{2,100}$/.test(error)) {
      throw new Error('JOB_FAILURE_ARGUMENT_INVALID');
    }
    const result = await this.transactions.database(context).query(
      `with failed as(update runtime.jobs set state=$3,lease_owner=null,lease_deadline=null,
       available_at=case when $3='queued' then clock_timestamp()+make_interval(secs=>$4::double precision/1000) else available_at end,
       checkpoint=checkpoint||jsonb_build_object('errorCode',$6::text),version=version+1,updated_by=$2,updated_at=clock_timestamp()
       where id=$1 and state='running' and lease_owner=$2 and fencing_token=$5 and lease_deadline>clock_timestamp()
       and cancel_requested_at is null returning id,attempts)
       update runtime.job_attempts attempt set state='failed',error_code=$6,finished_at=clock_timestamp()
       from failed where attempt.job_id=failed.id and attempt.attempt=failed.attempts and attempt.state='running' returning attempt.id`,
      [job.id, worker, terminal ? 'deadlettered' : 'queued', delay, job.token, error]
    );
    if (result.rowCount !== 1) throw new Error('JOB_LEASE_LOST');
  }
}

function validateClaim(request: JobClaim): void {
  if (
    !/^[a-z][a-z0-9]+$/.test(request.kind) ||
    !/^[a-z]+$/.test(request.queue) ||
    !/^[A-Za-z0-9][A-Za-z0-9:._-]{1,254}$/.test(request.worker) ||
    !['jobs', 'provider'].includes(request.workload) ||
    !Number.isSafeInteger(request.batch) ||
    request.batch < 1 ||
    request.batch > 1000 ||
    !Number.isSafeInteger(request.concurrency) ||
    request.concurrency < 1 ||
    request.concurrency > 1000
  ) {
    throw new Error('JOB_CLAIM_ARGUMENT_INVALID');
  }
  validateLeaseSeconds(request.lease);
}

function validateLeaseSeconds(seconds: number): void {
  if (!Number.isSafeInteger(seconds) || seconds < 5 || seconds > 900) throw new Error('JOB_LEASE_ARGUMENT_INVALID');
}

function claimedJob(row: ClaimedJobRow, kind: string): ClaimedJob {
  if (
    !row.id.startsWith('job:') ||
    row.kind !== kind ||
    (row.scope_id !== null && !row.scope_id) ||
    row.authorization_snapshot === null ||
    typeof row.authorization_snapshot !== 'object' ||
    Array.isArray(row.authorization_snapshot) ||
    !Number.isSafeInteger(Number(row.attempts)) ||
    Number(row.attempts) < 1 ||
    !Number.isSafeInteger(Number(row.fencing_token)) ||
    Number(row.fencing_token) < 1
  ) {
    throw new Error('JOB_QUEUE_RECORD_INVALID');
  }
  return Object.freeze({ id: row.id, kind: row.kind, scope: row.scope_id, payload: row.payload, authorization: Object.freeze({ ...row.authorization_snapshot }), attempts: Number(row.attempts), token: Number(row.fencing_token) });
}
