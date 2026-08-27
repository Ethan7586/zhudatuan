import type { ClaimedJob, JobProcessor } from '../../../../foundation/application/JobRunner';
import type { DispatchNotification } from '../../application/command/DispatchNotification';

export class NotificationJobProcessor implements JobProcessor {
  constructor(private readonly dispatches: DispatchNotification) {}

  async process(job: ClaimedJob, signal: AbortSignal): Promise<void> {
    if (job.kind !== 'notification') throw new Error('JOB_KIND_MISMATCH'); if (signal.aborted) throw signal.reason;
    const payload = object(job.payload);
    if (payload.challenge !== undefined) return this.dispatches.challenge(text(payload.challenge, 'IDENTITY_CHALLENGE_REQUIRED'));
    if (payload.dispatch !== undefined) return this.dispatches.dispatch(text(payload.dispatch, 'NOTIFICATION_DISPATCH_REQUIRED'));
    if (payload.event !== undefined) return this.dispatches.event({ job: job.id, id: text(payload.eventId, 'NOTIFICATION_EVENT_ID_REQUIRED'),
      type: text(payload.event, 'NOTIFICATION_EVENT_REQUIRED'), payload: object(payload.payload ?? payload) });
    throw new Error('NOTIFICATION_JOB_SUBTYPE_INVALID');
  }
}

function object(value: unknown): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('JOB_PAYLOAD_INVALID'); return value as Record<string, unknown>;
}
function text(value: unknown, code: string): string { if (typeof value !== 'string' || !value) throw new Error(code); return value; }
