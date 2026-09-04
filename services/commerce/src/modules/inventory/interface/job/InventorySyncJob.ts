import type { ClaimedJob, JobProcessor } from '../../../runtime/public/JobProcess';
import type { RestockReturn } from '../../application/process/RestockReturn';

export class InventorySyncJob implements JobProcessor {
  constructor(
    private readonly restock: RestockReturn,
    private readonly provider: JobProcessor
  ) {}

  process(job: ClaimedJob, signal: AbortSignal, deadline = Date.now() + 30_000): Promise<void> {
    if (job.kind !== 'inventorysync') throw new Error('JOB_KIND_MISMATCH');
    if (signal.aborted) throw signal.reason;
    const payload = object(job.payload);
    if (payload.return === undefined) return this.provider.process(job, signal, deadline);
    if (typeof payload.return !== 'string' || !payload.return) throw new Error('INVENTORY_RETURN_REQUIRED');
    return this.restock.execute(payload.return, {
      scope: job.scope || 'inventory',
      trace: job.id,
      signal,
      deadline,
    });
  }
}

function object(value: unknown): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('JOB_PAYLOAD_INVALID');
  return value as Readonly<Record<string, unknown>>;
}
