import type { ClaimedJob, JobProcessor } from '../../../runtime/public/JobProcess';
import type { RevokeStaleSessions } from '../../application/process/RevokeStaleSessions';

export class SessionRevocationJob implements JobProcessor {
  constructor(private readonly revocation: RevokeStaleSessions) {}

  process(job: ClaimedJob, signal: AbortSignal, deadline = Date.now() + 15_000): Promise<void> {
    if (job.kind !== 'sessionrevocation') throw new Error('JOB_KIND_MISMATCH');
    if (signal.aborted) throw signal.reason;
    const envelope = record(job.payload, 'SESSION_REVOCATION_EVENT_INVALID');
    const type = text(envelope.event, 'SESSION_REVOCATION_EVENT_TYPE_REQUIRED');
    if (type !== 'access.version.changed') throw new Error('SESSION_REVOCATION_EVENT_UNSUPPORTED');
    const scope = text(envelope.scopeId, 'SESSION_REVOCATION_SCOPE_REQUIRED');
    if (job.scope !== scope) throw new Error('SESSION_REVOCATION_SCOPE_MISMATCH');
    return this.revocation.execute(text(envelope.eventId, 'SESSION_REVOCATION_EVENT_ID_REQUIRED'), record(envelope.payload, 'SESSION_REVOCATION_PAYLOAD_INVALID'), { scope, trace: job.id, signal, deadline });
  }
}

function record(value: unknown, code: string): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(code);
  return value as Readonly<Record<string, unknown>>;
}

function text(value: unknown, code: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error(code);
  return value;
}
