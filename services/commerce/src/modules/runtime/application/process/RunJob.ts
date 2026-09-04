import { Deadline } from '../../../../foundation/performance/Deadline';
import { mapParallel } from '../../../../foundation/performance/Parallel';
import { retryDelay } from '../../../../foundation/performance/Retry';
import type { JobMetrics } from '../../../../foundation/telemetry/JobMetrics';
import { ApplicationError } from '../../../../foundation/domain/ApplicationError';
import type { TransactionManager, TransactionOptions } from '../../../../foundation/persistence/TransactionManager';
import type { DeadletterStore } from '../../../../foundation/application/DeadletterStore';
import type { ClaimedJob, JobAuthorization, JobDeadletter, JobProcessor, JobQueuePort, JobRunnerConfig } from '../../public/JobProcess';

export class RunJob {
  constructor(
    private readonly transactions: TransactionManager,
    private readonly repository: JobQueuePort,
    private readonly deadletters: DeadletterStore,
    private readonly config: JobRunnerConfig,
    private readonly authorization: JobAuthorization,
    private readonly deadletter?: JobDeadletter,
    private readonly metrics?: JobMetrics
  ) {}

  async execute(kind: string, processor: JobProcessor, signal: AbortSignal): Promise<void> {
    while (!signal.aborted) {
      const jobs = await this.transactions.write(this.options(kind, signal, `claim:${kind}`), (context) =>
        this.repository.claim(context, { kind, queue: this.config.queue, worker: this.config.worker, batch: this.config.batch,
          lease: this.config.lease, workload: this.config.workload, concurrency: this.config.concurrency }));
      if (jobs.length === 0) {
        await delay(this.config.poll, signal);
        continue;
      }
      await mapParallel(jobs, this.config.concurrency, (job) => this.process(job, processor, signal));
    }
  }

  private async process(job: ClaimedJob, processor: JobProcessor, signal: AbortSignal): Promise<void> {
    const started = performance.now();
    let authorized: boolean;
    try { authorized = await this.authorize(job); }
    catch (cause) {
      this.metrics?.failure(job, this.config.owner, cause);
      const outcome = await this.fail(job, cause);
      this.metrics?.observe(job, this.config.owner, performance.now() - started, outcome, safeErrorCode(cause));
      return;
    }
    if (!authorized) {
      this.metrics?.observe(job, this.config.owner, performance.now() - started, 'cancelled', 'AUTHORIZATION_DENIED');
      return;
    }
    const expiresAt = Date.now() + this.config.deadline;
    const execution = new AbortController();
    const abort = () => execution.abort(signal.reason ?? new Error('JOB_RUNNER_STOPPED'));
    if (signal.aborted) abort();
    else signal.addEventListener('abort', abort, { once: true });
    const deadline = Deadline.after(this.config.deadline, execution.signal);
    let cancelled = false;
    let leaseFailure: unknown;
    const heartbeatStop = new AbortController();
    const heartbeat = this.monitor(job, heartbeatStop.signal, (cause, isCancellation) => {
      leaseFailure = cause;
      cancelled = isCancellation;
      execution.abort(cause);
    });
    try {
      await processor.process(job, deadline.signal, expiresAt);
      heartbeatStop.abort();
      await heartbeat;
      if (leaseFailure !== undefined) throw leaseFailure;
      const settlement = new AbortController().signal;
      await this.transactions.write(this.options(job.scope ?? 'runtime', settlement, `complete:${job.id}`), (context) =>
        this.repository.complete(context, job, this.config.worker));
      this.metrics?.observe(job, this.config.owner, performance.now() - started, 'success');
    } catch (cause) {
      heartbeatStop.abort();
      await heartbeat;
      const failure = leaseFailure ?? cause;
      if (cancelled || safeErrorCode(failure) === 'JOB_LEASE_LOST') {
        this.metrics?.observe(job, this.config.owner, performance.now() - started, 'cancelled', safeErrorCode(failure));
        return;
      }
      this.metrics?.failure(job, this.config.owner, failure);
      const outcome = await this.fail(job, failure);
      this.metrics?.observe(job, this.config.owner, performance.now() - started, outcome, safeErrorCode(failure));
    } finally {
      heartbeatStop.abort();
      await heartbeat;
      deadline.dispose();
      signal.removeEventListener('abort', abort);
    }
  }

  private async authorize(job: ClaimedJob): Promise<boolean> {
    try {
      if (job.authorization.kind === 'system') assertSystemAuthorization(job);
      else {
        const signal = new AbortController().signal;
        await this.transactions.read(this.options(job.scope ?? 'runtime', signal, `authorize:${job.id}`), (context) =>
          this.authorization.assert(context, job.authorization));
      }
      return true;
    } catch (cause) {
      if (safeErrorCode(cause) !== 'AUTHORIZATION_DENIED' && !(cause instanceof Error && cause.message.startsWith('JOB_SYSTEM_AUTHORIZATION_'))) throw cause;
      const signal = new AbortController().signal;
      await this.transactions.write(this.options(job.scope ?? 'runtime', signal, `reject:${job.id}`), (context) =>
        this.repository.rejectAuthorization(context, job, this.config.worker));
      return false;
    }
  }

  private async heartbeat(job: ClaimedJob): Promise<boolean> {
    if (!(await this.authorize(job))) return false;
    const signal = new AbortController().signal;
    return this.transactions.write(this.options(job.scope ?? 'runtime', signal, `heartbeat:${job.id}`), (context) =>
      this.repository.heartbeat(context, job, this.config.worker, this.config.lease));
  }

  private async monitor(job: ClaimedJob, stop: AbortSignal, failed: (cause: unknown, cancelled: boolean) => void): Promise<void> {
    while (!stop.aborted) {
      await delay(Math.max(1_000, this.config.lease * 500), stop);
      if (stop.aborted) return;
      try {
        if (!(await this.heartbeat(job))) {
          failed(new Error('JOB_CANCELLED'), true);
          return;
        }
      } catch (cause) {
        failed(cause, false);
        return;
      }
    }
  }

  private async fail(job: ClaimedJob, cause: unknown): Promise<'retry' | 'deadletter'> {
    const code = safeErrorCode(cause);
    const terminal = permanent(code) || job.attempts >= this.config.attempts;
    const settlement = new AbortController().signal;
    return this.transactions.write(this.options(job.scope ?? 'runtime', settlement, `fail:${job.id}`), async (context) => {
      if (terminal) {
        await this.deadletters.record(context, { id: `job:${job.id}`, kind: 'job', source: job.id, owner: this.config.owner, payload: job.payload, error: code, attempts: job.attempts });
        await this.deadletter?.record(context, job, code);
      }
      const wait = terminal ? 0 : retryDelay(job.attempts, this.config.retryMinimum, this.config.retryMaximum);
      await this.repository.fail(context, job, this.config.worker, terminal, wait, code);
      return terminal ? 'deadletter' : 'retry';
    });
  }

  private options(scope: string, signal: AbortSignal, action: string): TransactionOptions {
    return { tenant: scope, membership: '', scope, actor: this.config.worker, trace: action,
      operation: `job.runtime.${action}`, workload: 'jobs', signal, deadline: Date.now() + this.config.deadline };
  }
}

function assertSystemAuthorization(job: ClaimedJob): void {
  const evidence = job.authorization;
  const text = (field: string) => typeof evidence[field] === 'string' && String(evidence[field]).trim().length > 0;
  const source = evidence.source;
  const captured = typeof evidence.capturedAt === 'string' ? Date.parse(evidence.capturedAt) : Number.NaN;
  if (!text('actor') || !text('operation') || evidence.scope !== job.scope || !['jobs', 'provider', 'scheduler'].includes(String(source))
    || !Number.isFinite(captured) || captured > Date.now() + 5_000) throw new Error('JOB_SYSTEM_AUTHORIZATION_INVALID');
}

function permanent(code: string): boolean {
  return ['AUTHORIZATION_DENIED', 'JOB_SYSTEM_AUTHORIZATION_INVALID', 'JOB_PAYLOAD_INVALID', 'JOB_KIND_INVALID'].includes(code) ||
    code.endsWith('_SIGNATURE_INVALID') || code.startsWith('CHANNEL_WEBHOOK_') && ['_INVALID', '_REQUIRED', '_MISMATCH'].some((suffix) => code.endsWith(suffix));
}

function safeErrorCode(cause: unknown): string {
  if (cause instanceof ApplicationError) return cause.code;
  if (cause instanceof Error && /^[A-Z][A-Z0-9_]{2,100}$/.test(cause.message)) return cause.message;
  return 'JOB_FAILED';
}

function delay(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const timer = setTimeout(resolve, milliseconds);
    signal.addEventListener('abort', () => { clearTimeout(timer); resolve(); }, { once: true });
  });
}
