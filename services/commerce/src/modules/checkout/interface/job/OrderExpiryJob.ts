import type { ClaimedJob, JobProcessor } from '../../../../foundation/application/JobRunner';
import type { ExpireOrders } from '../../application/process/ExpireOrders';

export class OrderExpiryJob implements JobProcessor {
  constructor(private readonly expiry: ExpireOrders) {}

  process(job: ClaimedJob, signal: AbortSignal, deadline = Date.now() + 30_000): Promise<void> {
    if (job.kind !== 'orderexpiry') throw new Error('JOB_KIND_MISMATCH');
    if (signal.aborted) throw signal.reason;
    const payload = object(job.payload);
    return this.expiry.execute({
      checkout: optionalText(payload.checkout),
      order: optionalText(payload.order),
      scope: job.scope_id || 'order',
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

function optionalText(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || !value) throw new Error('JOB_PAYLOAD_INVALID');
  return value;
}
