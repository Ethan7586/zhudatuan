import type { Job, JobContext } from '../../../../pipeline/Job';
import type { DeadletterStore } from '../../../../pipeline/DeadletterStore';
import type { TransactionManager } from '../../../../platform/database/TransactionManager';
import type { JobMetrics } from '../../../../platform/telemetry/JobMetrics';
import { RunJob } from '../../application/process/RunJob';
import type { JobAuthorization, JobDeadletter, JobProcessor, JobQueuePort, JobRunnerConfig } from '../../public/JobProcess';

export class JobWorker implements Job<void> {
  readonly id: string;
  private readonly process: RunJob;

  constructor(
    id: string,
    transactions: TransactionManager,
    queue: JobQueuePort,
    deadletters: DeadletterStore,
    config: JobRunnerConfig,
    authorization: JobAuthorization,
    private readonly processor: JobProcessor,
    deadletter?: JobDeadletter,
    metrics?: JobMetrics
  ) {
    this.id = id;
    this.process = new RunJob(transactions, queue, deadletters, config, authorization, deadletter, metrics);
  }

  execute(_input: void, context: JobContext): Promise<void> {
    return this.process.execute(this.id, this.processor, context.signal);
  }
}
