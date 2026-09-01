import type { WriteTransactionContext } from '../persistence/TransactionContext';

export interface ScheduledJob {
  readonly id: string;
  readonly kind: string;
  readonly owner: string;
  readonly scope: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly priority: number;
  readonly availableAt?: string;
}

export interface JobScheduler {
  schedule(context: WriteTransactionContext, job: ScheduledJob): Promise<void>;
}
