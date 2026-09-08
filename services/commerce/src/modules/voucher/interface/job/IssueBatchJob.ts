import type { ClaimedJob, JobProcessor } from '../../../runtime/public/JobProcess';
import type { IssueBatchProcess } from '../../application/process/IssueBatchProcess';

export class IssueBatchJob implements JobProcessor {
  constructor(private readonly task: IssueBatchProcess) {}
  process(job: ClaimedJob, signal: AbortSignal, deadline = Date.now() + 120_000): Promise<void> {
    if (job.kind !== 'voucherissue') throw new Error('JOB_KIND_MISMATCH');
    const payload = record(job.payload);
    const scope = text(job.scope, 'VOUCHER_SCOPE_REQUIRED');
    if (typeof payload.eventId === 'string') return this.task.decide(payload.eventId, text(payload.event, 'VOUCHER_EVENT_TYPE_REQUIRED'), scope, record(payload.payload), signal, deadline);
    return this.task.execute(job.id, text(payload.batch, 'VOUCHER_BATCH_REQUIRED'), scope, signal, deadline);
  }
}
function record(value: unknown): Readonly<Record<string, unknown>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('JOB_PAYLOAD_INVALID');
  return value as Readonly<Record<string, unknown>>;
}
function text(value: unknown, code: string): string {
  if (typeof value !== 'string' || value === '') throw new Error(code);
  return value;
}
