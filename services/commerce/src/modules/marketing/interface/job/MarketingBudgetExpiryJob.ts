import type { ClaimedJob, JobProcessor } from '../../../runtime/public/JobProcess';
import type { ExpireMarketingBudget } from '../../application/process/ExpireMarketingBudget';

export class MarketingBudgetExpiryJob implements JobProcessor {
  constructor(private readonly expiry: ExpireMarketingBudget) {}

  process(job: ClaimedJob, signal: AbortSignal, deadline = Date.now() + 15_000): Promise<void> {
    if (job.kind !== 'marketingbudgetexpiry') throw new Error('JOB_KIND_MISMATCH');
    const payload = object(job.payload);
    return this.expiry.execute({ order: text(payload.order), scope: job.scope ?? 'organization-platform-root', trace: job.id, signal, deadline });
  }
}

function object(value: unknown): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('JOB_PAYLOAD_INVALID');
  return value as Readonly<Record<string, unknown>>;
}
function text(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error('JOB_PAYLOAD_INVALID');
  return value;
}
