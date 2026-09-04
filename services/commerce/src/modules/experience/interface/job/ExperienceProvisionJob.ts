import type { ClaimedJob, JobProcessor } from '../../../runtime/public/JobProcess';
import type { ProvisionExperience } from '../../application/process/ProvisionExperience';

export class ExperienceProvisionJob implements JobProcessor {
  constructor(private readonly provision: ProvisionExperience) {}

  process(job: ClaimedJob, signal: AbortSignal, deadline = Date.now() + 30_000): Promise<void> {
    if (job.kind !== 'experienceprovision') throw new Error('JOB_KIND_MISMATCH');
    if (signal.aborted) throw signal.reason;
    const envelope = record(job.payload, 'EXPERIENCE_PROVISION_ENVELOPE_INVALID');
    if (!['organization.mall.created', 'organization.mall.updated'].includes(text(envelope.event, 'EXPERIENCE_PROVISION_EVENT_REQUIRED'))) throw new Error('EXPERIENCE_PROVISION_EVENT_INVALID');
    const payload = record(envelope.payload, 'EXPERIENCE_PROVISION_PAYLOAD_INVALID');
    return this.provision.execute({
      event: text(envelope.eventId, 'EXPERIENCE_PROVISION_EVENT_ID_REQUIRED'),
      mall: text(payload.mallId, 'EXPERIENCE_PROVISION_MALL_REQUIRED'),
      mallVersion: positive(payload.version, 'EXPERIENCE_PROVISION_VERSION_REQUIRED'),
      actor: text(envelope.actorId, 'EXPERIENCE_PROVISION_ACTOR_REQUIRED'),
      scope: job.scope ?? text(envelope.scopeId, 'EXPERIENCE_PROVISION_SCOPE_REQUIRED'),
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
function positive(value: unknown, code: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1) throw new Error(code);
  return Number(value);
}
