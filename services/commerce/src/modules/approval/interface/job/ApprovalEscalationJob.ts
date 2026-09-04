import type { ClaimedJob, JobProcessor } from '../../../runtime/public/JobProcess';
import type { EscalateApproval } from '../../application/process/EscalateApproval';

export class ApprovalEscalationJob implements JobProcessor {
  constructor(private readonly approvals: EscalateApproval) {}

  process(job: ClaimedJob, signal: AbortSignal, deadline = Date.now() + 30_000): Promise<void> {
    if (job.kind !== 'approvalescalation') throw new Error('JOB_KIND_MISMATCH');
    if (signal.aborted) throw signal.reason;
    return this.approvals.execute(signal, deadline);
  }
}
