import type { ClaimedJob, JobProcessor } from '../../../runtime/public/JobProcess';
import type { NotificationDeliveryProcess } from '../../application/process/NotificationDeliveryProcess';

export class NotificationJobProcessor implements JobProcessor {
  constructor(private readonly dispatches: NotificationDeliveryProcess) {}

  async process(job: ClaimedJob, signal: AbortSignal, deadline = Date.now() + 30_000): Promise<void> {
    if (job.kind !== 'notification') throw new Error('JOB_KIND_MISMATCH');
    if (signal.aborted) throw signal.reason;
    const payload = object(job.payload);
    const execution = { scope: job.scope ?? 'notification', trace: job.id, signal, deadline };
    if (payload.challenge !== undefined) return this.dispatches.challenge(text(payload.challenge, 'IDENTITY_CHALLENGE_REQUIRED'), execution);
    if (payload.dispatch !== undefined) return this.dispatches.dispatch(text(payload.dispatch, 'NOTIFICATION_DISPATCH_REQUIRED'), execution);
    if (payload.event !== undefined)
      return this.dispatches.event({ job: job.id, id: text(payload.eventId, 'NOTIFICATION_EVENT_ID_REQUIRED'), type: text(payload.event, 'NOTIFICATION_EVENT_REQUIRED'), payload: object(payload.payload ?? payload) }, execution);
    throw new Error('NOTIFICATION_JOB_SUBTYPE_INVALID');
  }
}

export interface IdentityChallengeDispatcher {
  challenge(id: string, execution: Readonly<{ scope: string; trace: string; signal: AbortSignal; deadline: number }>): Promise<void>;
}

export class IdentityNotificationJobProcessor implements JobProcessor {
  constructor(private readonly dispatches: IdentityChallengeDispatcher) {}

  async process(job: ClaimedJob, signal: AbortSignal, deadline = Date.now() + 30_000): Promise<void> {
    if (job.kind !== 'identitynotification') throw new Error('JOB_KIND_MISMATCH');
    if (signal.aborted) throw signal.reason;
    const payload = object(job.payload);
    if (Object.keys(payload).join(',') !== 'challenge') throw new Error('IDENTITY_NOTIFICATION_PAYLOAD_INVALID');
    const challenge = text(payload.challenge, 'IDENTITY_CHALLENGE_REQUIRED');
    if (!/^challenge:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(challenge)) {
      throw new Error('IDENTITY_CHALLENGE_INVALID');
    }
    await this.dispatches.challenge(challenge, { scope: job.scope ?? 'identity', trace: job.id, signal, deadline });
  }
}

function object(value: unknown): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('JOB_PAYLOAD_INVALID');
  return value as Record<string, unknown>;
}
function text(value: unknown, code: string): string {
  if (typeof value !== 'string' || !value) throw new Error(code);
  return value;
}
