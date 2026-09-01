import type { ClaimedJob, JobProcessor } from '../../../../foundation/application/JobRunner';
import type { PublishExperience } from '../../application/process/PublishExperience';

export class ExperiencePublishJob implements JobProcessor {
  constructor(private readonly publication: PublishExperience) {}

  process(job: ClaimedJob, signal: AbortSignal, deadline = Date.now() + 30_000): Promise<void> {
    if (job.kind !== 'experiencepublish') throw new Error('JOB_KIND_MISMATCH');
    if (signal.aborted) throw signal.reason;
    const envelope = record(job.payload, 'EXPERIENCE_EVENT_ENVELOPE_INVALID');
    if (text(envelope.event, 'EXPERIENCE_EVENT_TYPE_REQUIRED') !== 'experience.published') throw new Error('EXPERIENCE_EVENT_TYPE_INVALID');
    const payload = record(envelope.payload, 'EXPERIENCE_EVENT_PAYLOAD_INVALID');
    return this.publication.execute({
      event: text(envelope.eventId, 'EXPERIENCE_EVENT_ID_REQUIRED'),
      application: text(payload.application, 'EXPERIENCE_APPLICATION_REQUIRED'),
      release: text(payload.release, 'EXPERIENCE_RELEASE_REQUIRED'),
      version: text(payload.version, 'EXPERIENCE_VERSION_REQUIRED'),
      path: text(payload.key, 'EXPERIENCE_OBJECT_KEY_REQUIRED'),
      hash: text(payload.hash, 'EXPERIENCE_HASH_REQUIRED'),
      scope: job.scope_id ?? 'organization-platform-root',
      trace: job.id,
      signal,
      deadline,
    });
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
