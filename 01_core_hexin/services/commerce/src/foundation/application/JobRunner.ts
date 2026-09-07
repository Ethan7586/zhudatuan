import type { QueryResultRow } from 'pg';
import type { DatabasePool } from '../persistence/Pool';
import { Semaphore } from '../performance/Semaphore';
import { Deadline } from '../performance/Deadline';
import { retryDelay } from '../performance/Retry';
import type { JobMetrics } from '../telemetry/JobMetrics';

export interface ClaimedJob extends QueryResultRow {
  readonly id: string;
  readonly kind: string;
  readonly scope_id: string | null;
  readonly payload: unknown;
  readonly attempts: number;
}

export interface JobDeadletter {
  record(database: Readonly<{ query(text: string, values?: readonly unknown[]): Promise<unknown> }>, job: ClaimedJob, error: string): Promise<void>;
}

export interface JobProcessor {
  process(job: ClaimedJob, signal: AbortSignal): Promise<void>;
}

export interface JobRunnerConfig {
  readonly worker: string;
  readonly owner: string;
  readonly batch: number;
  readonly lease: number;
  readonly concurrency: number;
  readonly attempts: number;
  readonly poll: number;
  readonly deadline: number;
  readonly retryMinimum: number;
  readonly retryMaximum: number;
  readonly claim?: 'identity-notification';
  readonly scope?: string;
}

export class JobRunner {
  private readonly semaphore: Semaphore;

  constructor(private readonly pool: DatabasePool, private readonly config: JobRunnerConfig, private readonly deadletter?: JobDeadletter,
    private readonly metrics?: JobMetrics) {
    this.semaphore = new Semaphore(config.concurrency);
  }

  async run(kind: string, processor: JobProcessor, signal: AbortSignal): Promise<void> {
    while (!signal.aborted) {
      const result = this.config.claim === 'identity-notification'
        ? await this.pool.query<ClaimedJob>(
          'select id,kind,scope_id,payload,attempts from runtime.claim_identity_notification_job($1,$2,$3)',
          [this.config.worker, this.config.batch, this.config.lease],
        )
        : this.config.scope !== undefined
          ? await this.pool.query<ClaimedJob>(`with candidates as (
              select id from runtime.job where kind=$1 and scope_id=$2 and state='queued' and available_at<=clock_timestamp()
              order by priority,available_at,id for update skip locked limit $3
            )
            update runtime.job target set state='running',lease_owner=$4,
              lease_deadline=clock_timestamp()+make_interval(secs=>$5),attempts=target.attempts+1,updated_at=clock_timestamp()
            from candidates where target.id=candidates.id
            returning target.id,target.kind,target.scope_id,target.payload,target.attempts`,
          [kind, this.config.scope, this.config.batch, this.config.worker, this.config.lease])
        : await this.pool.query<ClaimedJob>(
          'select id,kind,scope_id,payload,attempts from runtime.claim_job($1,$2,$3,$4)',
          [kind, this.config.worker, this.config.batch, this.config.lease],
        );
      if (result.rows.length === 0) {
        await delay(this.config.poll, signal);
        continue;
      }
      await Promise.all(result.rows.map((job) => this.semaphore.use(() => this.process(job, processor, signal))));
    }
  }

  private async process(job: ClaimedJob, processor: JobProcessor, signal: AbortSignal): Promise<void> {
    if (this.config.scope !== undefined && job.scope_id !== this.config.scope) throw new Error('JOB_SCOPE_MISMATCH');
    const deadline = Deadline.after(this.config.deadline, signal);
    const started = performance.now();
    const heartbeat = setInterval(() => void this.heartbeat(job.id).catch(() => undefined), Math.max(1_000, this.config.lease * 500));
    try {
      await processor.process(job, deadline.signal);
      const result = await this.pool.query(
        `update runtime.job set state='completed',lease_owner=null,lease_deadline=null,updated_at=clock_timestamp()
         where id=$1 and state='running' and lease_owner=$2 and ($3::text is null or scope_id=$3)`,
        [job.id, this.config.worker, this.config.scope ?? null],
      );
      if (result.rowCount !== 1) throw new Error('JOB_LEASE_LOST');
      this.metrics?.observe(job, this.config.owner, performance.now()-started, 'success');
    } catch (cause) {
      const outcome = await this.fail(job, cause);
      this.metrics?.observe(job, this.config.owner, performance.now()-started, outcome,
        cause instanceof Error ? cause.message.slice(0, 120) : 'JOB_FAILED');
    } finally {
      clearInterval(heartbeat);
      deadline.dispose();
    }
  }

  private async heartbeat(id: string): Promise<void> {
    const result = await this.pool.query(`update runtime.job set lease_deadline=clock_timestamp()+make_interval(secs=>$3),updated_at=clock_timestamp()
      where id=$1 and state='running' and lease_owner=$2 and ($4::text is null or scope_id=$4)`,
    [id, this.config.worker, this.config.lease, this.config.scope ?? null]);
    if (result.rowCount !== 1) throw new Error('JOB_LEASE_LOST');
  }

  private async fail(job: ClaimedJob, cause: unknown): Promise<'retry' | 'deadletter'> {
    const code = cause instanceof Error ? cause.message.slice(0, 200) : 'JOB_FAILED';
    const terminal = job.attempts >= this.config.attempts;
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      if (terminal) {
        await client.query(
          `insert into runtime.deadletter(id,kind,source_id,owner,payload,error_code,attempts,failed_at)
           values($1,'job',$2,$3,$4::jsonb,$5,$6,clock_timestamp())
           on conflict(kind,source_id) do update set payload=excluded.payload,error_code=excluded.error_code,attempts=excluded.attempts,failed_at=excluded.failed_at,reviewed_at=null`,
          [`job:${job.id}`, job.id, this.config.owner, JSON.stringify(job.payload), code, job.attempts],
        );
        await this.deadletter?.record(client, job, code);
      }
      const delay = terminal ? 0 : retryDelay(job.attempts, this.config.retryMinimum, this.config.retryMaximum);
      const result = await client.query(
        `update runtime.job set state=$3,lease_owner=null,lease_deadline=null,
         available_at=case when $3='queued' then clock_timestamp()+make_interval(secs=>$4::double precision/1000) else available_at end,
         updated_at=clock_timestamp() where id=$1 and state='running' and lease_owner=$2 and ($5::text is null or scope_id=$5)`,
        [job.id, this.config.worker, terminal ? 'failed' : 'queued', delay, this.config.scope ?? null],
      );
      if (result.rowCount !== 1) throw new Error('JOB_LEASE_LOST');
      await client.query('commit');
      return terminal ? 'deadletter' : 'retry';
    } catch (failure) {
      await client.query('rollback');
      throw failure;
    } finally {
      client.release();
    }
  }
}

function delay(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const timer = setTimeout(resolve, milliseconds);
    signal.addEventListener('abort', () => { clearTimeout(timer); resolve(); }, { once: true });
  });
}
