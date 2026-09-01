import type { ClaimedJob, JobProcessor } from '../../../../foundation/application/JobRunner';
import type { ReplayRiskPolicy } from '../../application/process/ReplayRiskPolicy';

export class RiskReplayJob implements JobProcessor {
  constructor(private readonly replay: ReplayRiskPolicy) {}

  process(job: ClaimedJob, signal: AbortSignal, deadline = Date.now() + 30_000): Promise<void> {
    if (job.kind !== 'riskscan') throw new Error('JOB_KIND_MISMATCH');
    if (signal.aborted) throw signal.reason;
    const payload = record(job.payload, 'JOB_PAYLOAD_INVALID');
    const execution = { scope: job.scope_id || 'risk', trace: job.id, signal, deadline };
    if (typeof payload.catalogDecision === 'string') return this.replay.applyCatalogDecision(payload.catalogDecision, execution);
    return this.replay.replay(text(payload.policy, 'RISK_POLICY_REQUIRED'), integer(payload.version, 'RISK_POLICY_VERSION_REQUIRED'), execution);
  }
}

function integer(value: unknown, code: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) throw new Error(code);
  return value as number;
}

function text(value: unknown, code: string): string {
  if (typeof value !== 'string' || !value) throw new Error(code);
  return value;
}

function record(value: unknown, code: string): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(code);
  return value as Readonly<Record<string, unknown>>;
}
