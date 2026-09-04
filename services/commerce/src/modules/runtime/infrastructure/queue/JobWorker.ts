import type { Job, JobContext } from '../../../../foundation/application/Job';
import type { DeadletterStore } from '../../../../foundation/application/DeadletterStore';
import type { TransactionManager } from '../../../../foundation/persistence/TransactionManager';
import type { JobMetrics } from '../../../../foundation/telemetry/JobMetrics';
import { RunJob } from '../../application/process/RunJob';
import type { JobAuthorization, JobDeadletter, JobProcessor, JobQueuePort, JobRunnerConfig } from '../../public/JobProcess';

export class JobWorker implements Job<void> {
  readonly id: string;
  private readonly process: RunJob;

  constructor(id: string, transactions: TransactionManager, queue: JobQueuePort, deadletters: DeadletterStore, config: JobRunnerConfig,
    authorization: JobAuthorization, private readonly processor: JobProcessor, deadletter?: JobDeadletter, metrics?: JobMetrics) {
    this.id = id;
    this.process = new RunJob(transactions, queue, deadletters, config, authorization, deadletter, metrics);
  }

  execute(_input: void, context: JobContext): Promise<void> {
    return this.process.execute(this.id, this.processor, context.signal);
  }
}
