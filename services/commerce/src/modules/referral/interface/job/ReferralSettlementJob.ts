import type { ClaimedJob, JobProcessor } from '../../../../foundation/application/JobRunner';
import type { SettleReferral } from '../../application/process/SettleReferral';

export class ReferralSettlementJob implements JobProcessor {
  constructor(private readonly settle: SettleReferral) {}

  async process(job: ClaimedJob, signal: AbortSignal, deadline = Date.now() + 30_000): Promise<void> {
    if (job.kind !== 'referralsettlement') throw new Error('JOB_KIND_MISMATCH');
    if (signal.aborted) throw signal.reason;
    const payload = object(job.payload);
    const scopeId = text(payload.scopeId, 'REFERRAL_SCOPE_REQUIRED');
    if (job.scope_id !== scopeId) throw new Error('REFERRAL_SCOPE_MISMATCH');
    const orderId = payload.orderId === null || payload.orderId === undefined ? null : text(payload.orderId, 'REFERRAL_ORDER_REFERENCE_INVALID');
    await this.settle.execute(scopeId, orderId, signal, deadline);
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
