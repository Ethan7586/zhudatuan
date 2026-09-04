import type { ClaimedJob, JobProcessor } from '../../../runtime/public/JobProcess';
import type { RunSettlement } from '../../application/process/RunSettlement';

export class SettlementJob implements JobProcessor {
  constructor(private readonly settlements: RunSettlement) {}

  process(job: ClaimedJob, signal: AbortSignal, deadline = Date.now() + 30_000): Promise<void> {
    if (job.kind !== 'settlement') throw new Error('JOB_KIND_MISMATCH');
    if (signal.aborted) throw signal.reason;
    const payload = object(job.payload);
    const execution = { scope: job.scope || 'finance', trace: job.id, signal, deadline };
    if (payload.withdrawal !== undefined) {
      return this.settlements.withdraw(text(payload.withdrawal, 'WITHDRAWAL_REQUIRED'), execution);
    }
    return this.settlements.settle(text(payload.reconciliation, 'RECONCILIATION_REQUIRED'), execution);
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
