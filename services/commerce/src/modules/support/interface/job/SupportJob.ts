import type { ClaimedJob, JobProcessor } from '../../../../foundation/application/JobRunner';
import type { RunSupportJob } from '../../application/process/RunSupportJob';

export class SupportJob implements JobProcessor {
  constructor(
    private readonly kind: 'supportsla' | 'supportscan',
    private readonly processManager: RunSupportJob
  ) {}

  process(job: ClaimedJob, signal: AbortSignal, deadline = Date.now() + 30_000): Promise<void> {
    if (job.kind !== this.kind) throw new Error('JOB_KIND_MISMATCH');
    if (signal.aborted) throw signal.reason;
    const payload = record(job.payload);
    const execution = { scope: job.scope_id ?? 'organization-platform-root', trace: job.id, signal, deadline };
    if (this.kind === 'supportscan') return this.processManager.scan(text(payload.evidence, 'SUPPORT_EVIDENCE_REQUIRED'), execution);
    return this.processManager.escalate(text(payload.ticket, 'SUPPORT_TICKET_REQUIRED'), phase(payload.phase), execution);
  }
}

function record(value: unknown): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('JOB_PAYLOAD_INVALID');
  return value as Readonly<Record<string, unknown>>;
}

function text(value: unknown, code: string): string {
  if (typeof value !== 'string' || !value) throw new Error(code);
  return value;
}

function phase(value: unknown): 'response' | 'resolution' {
  if (value !== 'response' && value !== 'resolution') throw new Error('SUPPORT_SLA_PHASE_INVALID');
  return value;
}
