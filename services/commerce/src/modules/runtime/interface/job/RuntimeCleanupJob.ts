import type { ClaimedJob, JobProcessor } from '../../../../foundation/application/JobRunner';
import type { CleanupRuntime } from '../../application/process/CleanupRuntime';

export class RuntimeCleanupJob implements JobProcessor {
  constructor(private readonly cleanup: CleanupRuntime) {}

  process(job: ClaimedJob, signal: AbortSignal, deadline = Date.now() + 30_000): Promise<void> {
    if (job.kind !== 'cleanup') throw new Error('JOB_KIND_MISMATCH');
    if (signal.aborted) throw signal.reason;
    return this.cleanup.execute(job.id, signal, deadline);
  }
}
