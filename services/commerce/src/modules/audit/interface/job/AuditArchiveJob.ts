import type { ClaimedJob, JobProcessor } from '../../../runtime/public/JobProcess';
import type { ArchiveAudit } from '../../application/process/ArchiveAudit';

export class AuditArchiveJob implements JobProcessor {
  constructor(private readonly archive: ArchiveAudit) {}

  process(job: ClaimedJob, signal: AbortSignal, deadline = Date.now() + 300_000): Promise<void> {
    if (job.kind !== 'auditarchive') throw new Error('JOB_KIND_MISMATCH');
    if (signal.aborted) throw signal.reason;
    return this.archive.execute(job.id, signal, deadline);
  }
}
