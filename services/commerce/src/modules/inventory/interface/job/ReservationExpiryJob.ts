import type { ClaimedJob, JobProcessor } from '../../../runtime/public/JobProcess';
import type { ExpireReservations } from '../../application/process/ExpireReservations';

export class ReservationExpiryJob implements JobProcessor {
  constructor(private readonly expiry: ExpireReservations) {}

  process(job: ClaimedJob, signal: AbortSignal, deadline = Date.now() + 30_000): Promise<void> {
    if (job.kind !== 'reservationexpiry') throw new Error('JOB_KIND_MISMATCH');
    const payload = object(job.payload);
    return this.expiry.execute({ owner: optional(payload.owner), scope: job.scope ?? 'organization-platform-root', trace: job.id, signal, deadline });
  }
}

function object(value: unknown): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('JOB_PAYLOAD_INVALID');
  return value as Readonly<Record<string, unknown>>;
}
function optional(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || value.length === 0) throw new Error('JOB_PAYLOAD_INVALID');
  return value;
}
