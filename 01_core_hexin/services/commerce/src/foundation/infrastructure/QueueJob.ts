import type { Job, JobContext } from '../application/Job';
import { JobRunner, type JobDeadletter, type JobProcessor, type JobRunnerConfig } from '../application/JobRunner';
import type { DatabasePool } from '../persistence/Pool';
import type { JobMetrics } from '../telemetry/JobMetrics';

export class QueueJob implements Job<void> {
  readonly id: string;
  private readonly runner: JobRunner;

  constructor(id: string, pool: DatabasePool, config: JobRunnerConfig, private readonly processor: JobProcessor, deadletter?: JobDeadletter,
    metrics?: JobMetrics) {
    this.id = id;
    this.runner = new JobRunner(pool, config, deadletter, metrics);
  }

  execute(_input: void, context: JobContext): Promise<void> {
    return this.runner.run(this.id, this.processor, context.signal);
  }
}
