import type { ClaimedJob, JobProcessor } from '../../../../foundation/application/JobRunner';
import type { DatabasePool } from '../../../../foundation/persistence/Pool';
import { SettleCommissions } from '../../application/command/SettleCommissions';
import type { FinancePoster } from '../../application/port/FinancePoster';

export class ReferralSettlementJob implements JobProcessor {
  private readonly settle: SettleCommissions;

  constructor(pool: DatabasePool, finance: FinancePoster) {
    this.settle = new SettleCommissions(pool, finance);
  }

  async process(job: ClaimedJob, signal: AbortSignal): Promise<void> {
    if (job.kind !== 'referralsettlement') throw new Error('JOB_KIND_MISMATCH');
    if (signal.aborted) throw signal.reason;
    const payload = object(job.payload);
    const scopeId = text(payload.scopeId, 'REFERRAL_SCOPE_REQUIRED');
    if (job.scope_id !== scopeId) throw new Error('REFERRAL_SCOPE_MISMATCH');
    const orderId = payload.orderId === null || payload.orderId === undefined ? null : text(payload.orderId, 'REFERRAL_ORDER_REFERENCE_INVALID');
    await this.settle.execute(scopeId, orderId);
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
