import type { ClaimedJob, JobProcessor } from '../../../runtime/public/JobProcess';
import type { ProjectReporting } from '../../application/process/ProjectReporting';

export class ProjectionJob implements JobProcessor {
  constructor(private readonly projection: ProjectReporting) {}

  process(job: ClaimedJob, signal: AbortSignal, deadline = Date.now() + 30_000): Promise<void> {
    if (job.kind !== 'projection') throw new Error('JOB_KIND_MISMATCH');
    if (signal.aborted) throw signal.reason;
    const event = text(object(job.payload).eventId, 'EVENT_ID_REQUIRED');
    return this.projection.execute(event, { scope: job.scope ?? 'reporting', trace: job.id, signal, deadline });
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
