import type { ClaimedJob, JobProcessor } from '../../../../foundation/application/JobRunner';
import type { InvalidateNavigation } from '../../application/process/InvalidateNavigation';

export class NavigationEventJob implements JobProcessor {
  constructor(private readonly invalidation: InvalidateNavigation) {}

  async process(job: ClaimedJob, signal: AbortSignal, deadline = Date.now() + 30_000): Promise<void> {
    if (job.kind !== 'navigation') throw new Error('JOB_KIND_MISMATCH');
    if (signal.aborted) throw signal.reason;
    const envelope = record(job.payload, 'NAVIGATION_EVENT_ENVELOPE_INVALID');
    const event = text(envelope.eventId, 'NAVIGATION_EVENT_ID_REQUIRED');
    const type = text(envelope.event, 'NAVIGATION_EVENT_TYPE_REQUIRED');
    const scope = text(envelope.scopeId, 'NAVIGATION_EVENT_SCOPE_REQUIRED');
    if (job.scope_id !== scope) throw new Error('NAVIGATION_EVENT_SCOPE_MISMATCH');
    await this.invalidation.execute(event, type, record(envelope.payload, 'NAVIGATION_EVENT_PAYLOAD_INVALID'), { scope, trace: job.id, signal, deadline });
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
