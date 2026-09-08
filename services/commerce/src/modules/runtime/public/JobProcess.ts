import type { ReadTransactionContext, WriteTransactionContext } from '../../../platform/database/TransactionContext';

export interface ClaimedJob {
  readonly id: string;
  readonly kind: string;
  readonly scope: string | null;
  readonly payload: unknown;
  readonly authorization: Readonly<Record<string, unknown>>;
  readonly attempts: number;
  readonly token: number;
}

export interface JobDeadletter {
  record(context: WriteTransactionContext, job: ClaimedJob, error: string): Promise<void>;
}

export interface JobClaim {
  readonly kind: string;
  readonly queue: string;
  readonly worker: string;
  readonly workload: 'jobs' | 'provider';
  readonly batch: number;
  readonly lease: number;
  readonly concurrency: number;
}

export interface JobQueuePort {
  claim(context: WriteTransactionContext, request: JobClaim): Promise<readonly ClaimedJob[]>;
  complete(context: WriteTransactionContext, job: ClaimedJob, worker: string): Promise<void>;
  heartbeat(context: WriteTransactionContext, job: ClaimedJob, worker: string, lease: number): Promise<boolean>;
  rejectAuthorization(context: WriteTransactionContext, job: ClaimedJob, worker: string): Promise<void>;
  fail(context: WriteTransactionContext, job: ClaimedJob, worker: string, terminal: boolean, delay: number, error: string): Promise<void>;
}

export interface JobProcessor {
  process(job: ClaimedJob, signal: AbortSignal, deadline?: number): Promise<void>;
}

export interface JobAuthorization {
  assert(context: ReadTransactionContext, evidence: Readonly<Record<string, unknown>>): Promise<void>;
}

export interface JobRunnerConfig {
  readonly worker: string;
  readonly workload: 'jobs' | 'provider';
  readonly owner: string;
  readonly queue: string;
  readonly batch: number;
  readonly lease: number;
  readonly concurrency: number;
  readonly attempts: number;
  readonly poll: number;
  readonly deadline: number;
  readonly retryMinimum: number;
  readonly retryMaximum: number;
}
