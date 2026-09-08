import type { ClaimedJob, JobProcessor } from '../../../runtime/public/JobProcess';
import type { ActionBatchProcess } from '../../application/process/ActionBatchProcess';

export class ActionBatchJob implements JobProcessor {
  constructor(private readonly task: ActionBatchProcess) {}
  process(job: ClaimedJob, signal: AbortSignal, deadline = Date.now() + 120_000): Promise<void> {
    if (job.kind !== 'voucheraction') throw new Error('JOB_KIND_MISMATCH');
    const payload = record(job.payload);
    return typeof payload.batch === 'string' ? this.task.execute(job.id, payload.batch, text(job.scope, 'VOUCHER_SCOPE_REQUIRED'), signal, deadline) : this.task.maintain(job.id, signal, deadline);
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
