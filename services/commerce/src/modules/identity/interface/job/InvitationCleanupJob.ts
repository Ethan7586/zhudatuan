import type { ClaimedJob, JobProcessor } from '../../../runtime/public/JobProcess';
import type { CleanupInvitations } from '../../application/process/CleanupInvitations';

export class InvitationCleanupJob implements JobProcessor {
  constructor(private readonly cleanup: CleanupInvitations) {}

  process(job: ClaimedJob, signal: AbortSignal, deadline = Date.now() + 30_000): Promise<void> {
    if (job.kind !== 'invitationcleanup') throw new Error('JOB_KIND_MISMATCH');
    if (signal.aborted) throw signal.reason;
    return this.cleanup.execute({
      scope: job.scope ?? 'organization-platform-root',
      trace: trace(job),
      job: job.id,
      attempts: job.attempts,
      signal,
      deadline,
    });
  }
}

function trace(job: ClaimedJob): string {
  if (job.payload && typeof job.payload === 'object' && !Array.isArray(job.payload)) {
    const value = Reflect.get(job.payload, 'traceId');
    if (typeof value === 'string' && value) return value;
  }
  return job.id;
}
