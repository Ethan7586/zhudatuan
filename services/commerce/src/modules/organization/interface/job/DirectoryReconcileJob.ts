import type { ClaimedJob, JobProcessor } from '../../../runtime/public/JobProcess';
import type { ReconcileDirectory } from '../../application/process/ReconcileDirectory';

export class DirectoryReconcileJob implements JobProcessor {
  constructor(private readonly reconciliation: ReconcileDirectory) {}

  async process(job: ClaimedJob, signal: AbortSignal, deadline = Date.now() + 300_000): Promise<void> {
    if (job.kind !== 'directoryreconcile') throw new Error('JOB_KIND_MISMATCH');
    if (signal.aborted) throw signal.reason;
    await this.reconciliation.execute(job.id, signal, deadline);
  }
}
