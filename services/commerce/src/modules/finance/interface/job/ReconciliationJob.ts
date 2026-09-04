import type { ClaimedJob, JobProcessor } from '../../../runtime/public/JobProcess';
import type { ReconcileFinance } from '../../application/process/ReconcileFinance';

export class ReconciliationJob implements JobProcessor {
  constructor(private readonly reconciliation: ReconcileFinance) {}

  async process(job: ClaimedJob, signal: AbortSignal, deadline = Date.now() + 30_000): Promise<void> {
    if (job.kind !== 'reconciliation') throw new Error('JOB_KIND_MISMATCH');
    if (signal.aborted) throw signal.reason;
    const payload = object(job.payload);
    if (payload.eventId) return this.reconciliation.post(payload, signal, deadline);
    const scope = typeof job.scope === 'string' && job.scope ? job.scope : 'finance';
    return this.reconciliation.execute(text(payload.reconciliation, 'RECONCILIATION_REQUIRED'), scope, signal, deadline);
  }
}

function object(value: unknown): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('JOB_PAYLOAD_INVALID');
  return value as Readonly<Record<string, unknown>>;
}
function text(value: unknown, code: string): string {
  if (typeof value !== 'string' || !value) throw new Error(code);
  return value;
}
