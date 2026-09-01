import type { Job, JobContext } from '../application/Job';
import { JobRunner, type JobDeadletter, type JobProcessor, type JobRunnerConfig } from '../application/JobRunner';
import type { JobMetrics } from '../telemetry/JobMetrics';
import type { TransactionManager } from '../persistence/TransactionManager';
import type { JobRepository } from '../application/JobRunner';
import type { DeadletterStore } from './DeadletterStore';

export class QueueJob implements Job<void> {
  readonly id: string;
  private readonly runner: JobRunner;

  constructor(
    id: string,
    transactions: TransactionManager,
    repository: JobRepository,
    deadletters: DeadletterStore,
    config: JobRunnerConfig,
    private readonly processor: JobProcessor,
    deadletter?: JobDeadletter,
    metrics?: JobMetrics
  ) {
    this.id = id;
    this.runner = new JobRunner(transactions, repository, deadletters, config, deadletter, metrics);
  }

  execute(_input: void, context: JobContext): Promise<void> {
    return this.runner.run(this.id, this.processor, context.signal);
  }
}
