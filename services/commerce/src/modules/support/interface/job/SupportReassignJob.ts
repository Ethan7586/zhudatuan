import type { ClaimedJob, JobProcessor } from '../../../runtime/public/JobProcess';
import type { RunSupportJob } from '../../application/process/RunSupportJob';

export class SupportReassignJob implements JobProcessor {
  constructor(private readonly processManager: RunSupportJob) {}
  process(job: ClaimedJob, signal: AbortSignal, deadline = Date.now() + 30_000): Promise<void> {
    if (job.kind !== 'supportreassign') throw new Error('JOB_KIND_MISMATCH');
    const payload = record(job.payload);
    const agent = text(payload.agent);
    const cursor = payload.cursor === null || payload.cursor === undefined ? null : text(payload.cursor);
    return this.processManager.reassign(agent, cursor, { scope: job.scope ?? 'organization-platform-root', trace: job.id, signal, deadline });
  }
}
function record(value: unknown): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('JOB_PAYLOAD_INVALID');
  return value as Readonly<Record<string, unknown>>;
}
function text(value: unknown): string {
  if (typeof value !== 'string' || !value) throw new Error('SUPPORT_AGENT_REQUIRED');
  return value;
}
