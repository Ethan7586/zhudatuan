import type { ClaimedJob, JobProcessor } from '../../../runtime/public/JobProcess';
import type { RunBenefitGrant } from '../../application/process/RunBenefitGrant';

export class BenefitJob implements JobProcessor {
  constructor(
    private readonly kind: 'benefitgrant' | 'benefitexpiry',
    private readonly grants: RunBenefitGrant
  ) {}

  process(job: ClaimedJob, signal: AbortSignal, deadline = Date.now() + 30_000): Promise<void> {
    if (job.kind !== this.kind) throw new Error('JOB_KIND_MISMATCH');
    if (signal.aborted) throw signal.reason;
    if (this.kind === 'benefitexpiry') return this.grants.expire(signal, deadline);
    const payload = object(job.payload);
    const subtype = payload.kind;
    if (subtype !== 'benefitgrant' && subtype !== 'benefitrevoke') throw new Error('BENEFIT_JOB_SUBTYPE_INVALID');
    return this.grants.execute(subtype, text(job.scope, 'BENEFIT_SCOPE_REQUIRED'), text(payload.batch, 'BENEFIT_BATCH_REQUIRED'), signal, deadline);
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
