import type { ClaimedJob, JobProcessor } from '../../../../foundation/application/JobRunner';
import type { SynchronizeDirectory } from '../../application/process/SynchronizeDirectory';

export class DirectorySyncJob implements JobProcessor {
  constructor(private readonly synchronization: SynchronizeDirectory) {}
  async process(job: ClaimedJob, signal: AbortSignal, deadline = Date.now() + 300_000): Promise<void> {
    if (job.kind !== 'directorysync') throw new Error('JOB_KIND_MISMATCH');
    const payload = record(job.payload);
    const connection = text(payload.connection);
    const run = text(payload.run);
    await this.synchronization.execute(connection, run, { trace: job.id, attempts: job.attempts, signal, deadline });
  }
}
function record(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('JOB_PAYLOAD_INVALID');
  return value as Record<string, unknown>;
}
function text(value: unknown): string {
  if (typeof value !== 'string' || !value) throw new Error('JOB_PAYLOAD_INVALID');
  return value;
}
