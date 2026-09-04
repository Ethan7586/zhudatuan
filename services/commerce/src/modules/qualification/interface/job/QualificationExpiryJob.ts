import type { ClaimedJob, JobProcessor } from '../../../runtime/public/JobProcess';
import type { ExpireQualification } from '../../application/process/ExpireQualification';

export class QualificationExpiryJob implements JobProcessor {
  constructor(private readonly expiry: ExpireQualification) {}

  process(job: ClaimedJob, signal: AbortSignal, deadline = Date.now() + 30_000): Promise<void> {
    if (job.kind !== 'qualificationexpiry') throw new Error('JOB_KIND_MISMATCH');
    const payload = record(job.payload);
    return this.expiry.execute({
      qualification: text(payload.qualification),
      scope: job.scope ?? text(payload.scope),
      version: positive(payload.version),
      trace: typeof payload.traceId === 'string' && payload.traceId ? payload.traceId : job.id,
      signal,
      deadline,
    });
  }
}

function record(value: unknown): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('QUALIFICATION_EXPIRY_PAYLOAD_INVALID');
  return value as Readonly<Record<string, unknown>>;
}
function text(value: unknown): string {
  if (typeof value !== 'string' || !value) throw new Error('QUALIFICATION_EXPIRY_PAYLOAD_INVALID');
  return value;
}
function positive(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1) throw new Error('QUALIFICATION_EXPIRY_PAYLOAD_INVALID');
  return Number(value);
}
