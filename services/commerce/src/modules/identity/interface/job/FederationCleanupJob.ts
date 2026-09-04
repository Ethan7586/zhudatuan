import type { ClaimedJob, JobProcessor } from '../../../runtime/public/JobProcess';
import type { CleanupFederation } from '../../application/process/CleanupFederation';

export class FederationCleanupJob implements JobProcessor {
  constructor(private readonly cleanup: CleanupFederation) {}

  process(job: ClaimedJob, signal: AbortSignal, deadline = Date.now() + 30_000): Promise<void> {
    if (job.kind !== 'federationcleanup') throw new Error('JOB_KIND_MISMATCH');
    if (signal.aborted) throw signal.reason;
    return this.cleanup.execute({ scope: job.scope ?? 'organization-platform-root', trace: job.id, signal, deadline });
  }
}
