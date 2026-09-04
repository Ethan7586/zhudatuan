import type { ClaimedJob, JobProcessor } from '../../../../foundation/application/JobRunner';
import type { DatabasePool } from '../../../../foundation/persistence/Pool';
import { ProcessReferralEvent } from '../../03_application_yingyong/command/ProcessReferralEvent';
import { SettleReferralCommissions } from '../../03_application_yingyong/command/SettleReferralCommissions';

export class ReferralEventJobProcessor implements JobProcessor {
  private readonly events: ProcessReferralEvent;
  private readonly settlement: SettleReferralCommissions;

  constructor(pool: DatabasePool) {
    this.events = new ProcessReferralEvent(pool);
    this.settlement = new SettleReferralCommissions(pool);
  }

  async process(job: ClaimedJob, signal: AbortSignal): Promise<void> {
    if (job.kind !== 'referral') throw new Error('JOB_KIND_MISMATCH');
    if (signal.aborted) throw signal.reason;
    const payload = object(job.payload);
    if (payload.eventId !== undefined) return this.events.execute(payload);
    const scope = text(payload.settleScope, 'REFERRAL_SCOPE_REQUIRED');
    if (job.scope_id !== scope) throw new Error('REFERRAL_SCOPE_MISMATCH');
    return this.settlement.execute(scope);
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
