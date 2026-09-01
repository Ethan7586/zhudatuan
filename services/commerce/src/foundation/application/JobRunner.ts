import type { QueryResultRow } from 'pg';
import { Semaphore } from '../performance/Semaphore';
import { Deadline } from '../performance/Deadline';
import { retryDelay } from '../performance/Retry';
import type { JobMetrics } from '../telemetry/JobMetrics';
import { ApplicationError } from '../domain/ApplicationError';
import type { ReadTransactionContext, WriteTransactionContext } from '../persistence/TransactionContext';
import type { TransactionManager, TransactionOptions } from '../persistence/TransactionManager';
import type { DeadletterStore } from '../infrastructure/DeadletterStore';

export interface ClaimedJob extends QueryResultRow {
  readonly id: string;
  readonly kind: string;
  readonly scope_id: string | null;
  readonly payload: unknown;
  readonly attempts: number;
  readonly fencing_token: number;
}

export interface JobDeadletter {
  record(context: WriteTransactionContext, job: ClaimedJob, error: string): Promise<void>;
}

export interface JobRepository {
  claim(context: WriteTransactionContext, kind: string, worker: string, batch: number, lease: number, workload: string): Promise<readonly ClaimedJob[]>;
  complete(context: WriteTransactionContext, job: ClaimedJob, worker: string): Promise<void>;
  heartbeat(context: WriteTransactionContext, job: ClaimedJob, worker: string, lease: number): Promise<void>;
  fail(context: WriteTransactionContext, job: ClaimedJob, worker: string, terminal: boolean, delay: number): Promise<void>;
}

export interface JobProcessor {
  process(job: ClaimedJob, signal: AbortSignal, deadline?: number): Promise<void>;
}

export interface JobRunnerConfig {
  readonly worker: string;
  readonly workload: 'jobs' | 'provider';
  readonly owner: string;
  readonly batch: number;
  readonly lease: number;
  readonly concurrency: number;
  readonly attempts: number;
  readonly poll: number;
  readonly deadline: number;
  readonly retryMinimum: number;
  readonly retryMaximum: number;
}

export class JobRunner {
  private readonly semaphore: Semaphore;

  constructor(
    private readonly transactions: TransactionManager,
    private readonly repository: JobRepository,
    private readonly deadletters: DeadletterStore,
    private readonly config: JobRunnerConfig,
    private readonly deadletter?: JobDeadletter,
    private readonly metrics?: JobMetrics
  ) {
    this.semaphore = new Semaphore(config.concurrency);
  }

  async run(kind: string, processor: JobProcessor, signal: AbortSignal): Promise<void> {
    while (!signal.aborted) {
      const jobs = await this.transactions.write(this.options(kind, signal, `claim:${kind}`), (context) => this.repository.claim(context, kind, this.config.worker, this.config.batch, this.config.lease, this.config.workload));
      if (jobs.length === 0) {
        await delay(this.config.poll, signal);
        continue;
      }
      await Promise.all(jobs.map((job) => this.semaphore.use(() => this.process(job, processor, signal))));
    }
  }

  private async process(job: ClaimedJob, processor: JobProcessor, signal: AbortSignal): Promise<void> {
    const expiresAt = Date.now() + this.config.deadline;
    const deadline = Deadline.after(this.config.deadline, signal);
    const started = performance.now();
    const heartbeat = setInterval(() => void this.heartbeat(job).catch(() => undefined), Math.max(1_000, this.config.lease * 500));
    try {
      await processor.process(job, deadline.signal, expiresAt);
      const settlement = new AbortController().signal;
      await this.transactions.write(this.options(job.scope_id ?? 'runtime', settlement, `complete:${job.id}`), (context) => this.repository.complete(context, job, this.config.worker));
      this.metrics?.observe(job, this.config.owner, performance.now() - started, 'success');
    } catch (cause) {
      this.metrics?.failure(job, this.config.owner, cause);
      const outcome = await this.fail(job, cause);
      this.metrics?.observe(job, this.config.owner, performance.now() - started, outcome, safeErrorCode(cause));
    } finally {
      clearInterval(heartbeat);
      deadline.dispose();
    }
  }

  private heartbeat(job: ClaimedJob): Promise<void> {
    const signal = new AbortController().signal;
    return this.transactions.write(this.options(job.scope_id ?? 'runtime', signal, `heartbeat:${job.id}`), (context) => this.repository.heartbeat(context, job, this.config.worker, this.config.lease));
  }

  private async fail(job: ClaimedJob, cause: unknown): Promise<'retry' | 'deadletter'> {
    const code = safeErrorCode(cause);
    const terminal = job.attempts >= this.config.attempts;
    const settlement = new AbortController().signal;
    return this.transactions.write(this.options(job.scope_id ?? 'runtime', settlement, `fail:${job.id}`), async (context) => {
      if (terminal) {
        await this.deadletters.record(context, { id: `job:${job.id}`, kind: 'job', source: job.id, owner: this.config.owner, payload: job.payload, error: code, attempts: job.attempts });
        await this.deadletter?.record(context, job, code);
      }
      const delay = terminal ? 0 : retryDelay(job.attempts, this.config.retryMinimum, this.config.retryMaximum);
      await this.repository.fail(context, job, this.config.worker, terminal, delay);
      return terminal ? 'deadletter' : 'retry';
    });
  }

  private options(scope: string, signal: AbortSignal, action: string): TransactionOptions {
    return { tenant: scope, membership: '', scope, actor: this.config.worker, trace: action, operation: `job.runtime.${action}`, workload: 'jobs', signal, deadline: Date.now() + this.config.deadline };
  }
}

function safeErrorCode(cause: unknown): string {
  return cause instanceof ApplicationError ? cause.code : 'JOB_FAILED';
}

function delay(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const timer = setTimeout(resolve, milliseconds);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true }
    );
  });
}
