import type { ClaimedJob, JobProcessor } from '../../../../foundation/application/JobRunner';
import type { RunVoucherBatch } from '../../application/process/RunVoucherBatch';

export class VoucherBatchJob implements JobProcessor {
  constructor(
    private readonly kind: 'voucherissue' | 'voucherstatus' | 'voucherexpiry',
    private readonly batches: RunVoucherBatch
  ) {}

  process(job: ClaimedJob, signal: AbortSignal, deadline = Date.now() + 30_000): Promise<void> {
    if (job.kind !== this.kind) throw new Error('JOB_KIND_MISMATCH');
    if (signal.aborted) throw signal.reason;
    const execution = { scope: job.scope_id ?? 'organization-platform-root', trace: job.id, signal, deadline };
    if (this.kind === 'voucherexpiry') return this.batches.expire(execution);
    const batch = identifier(job.payload, 'batch', 'VOUCHER_BATCH_REQUIRED');
    return this.kind === 'voucherstatus' ? this.batches.status(batch, execution) : this.batches.issue(batch, execution);
  }
}

function identifier(payload: unknown, field: string, code: string): string {
  const value = payload !== null && typeof payload === 'object' ? Reflect.get(payload, field) : null;
  if (typeof value !== 'string' || !value) throw new Error(code);
  return value;
}
