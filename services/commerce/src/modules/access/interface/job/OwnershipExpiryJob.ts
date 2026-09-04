import type { ClaimedJob, JobProcessor } from '../../../runtime/public/JobProcess';
import type { ExpireOwnershipTransfer } from '../../application/process/ExpireOwnershipTransfer';

export class OwnershipExpiryJob implements JobProcessor {
  constructor(private readonly expiry: ExpireOwnershipTransfer) {}

  process(job: ClaimedJob, signal: AbortSignal, deadline = Date.now() + 15_000): Promise<void> {
    if (job.kind !== 'ownershipexpiry') throw new Error('JOB_KIND_MISMATCH');
    const payload = job.payload;
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('OWNERSHIP_EXPIRY_PAYLOAD_INVALID');
    const transfer = Reflect.get(payload, 'transfer');
    const scope = Reflect.get(payload, 'scope');
    const traceId = Reflect.get(payload, 'traceId');
    if (typeof transfer !== 'string' || !transfer || typeof scope !== 'string' || !scope) throw new Error('OWNERSHIP_EXPIRY_PAYLOAD_INVALID');
    return this.expiry.execute({ job: job.id, transfer, scope, trace: typeof traceId === 'string' && traceId ? traceId : job.id, signal, deadline });
  }
}
