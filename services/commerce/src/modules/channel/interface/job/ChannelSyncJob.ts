import type { ClaimedJob, JobDeadletter, JobProcessor } from '../../../runtime/public/JobProcess';
import type { ChannelSyncKind } from '../../application/port/ChannelJobRepository';
import type { SynchronizeChannel } from '../../application/process/SynchronizeChannel';

export class ChannelSyncJob implements JobProcessor, JobDeadletter {
  constructor(
    private readonly kind: ChannelSyncKind,
    private readonly synchronization: SynchronizeChannel
  ) {}

  process(job: ClaimedJob, signal: AbortSignal, deadline = Date.now() + 300_000): Promise<void> {
    if (job.kind !== this.kind) throw new Error('JOB_KIND_MISMATCH');
    if (signal.aborted) throw signal.reason;
    const run = text(object(job.payload).run, 'CHANNEL_SYNC_RUN_REQUIRED');
    return this.synchronization.execute(run, { job: this.kind, scope: text(job.scope, 'CHANNEL_SYNC_SCOPE_REQUIRED'), trace: job.id, signal, deadline });
  }

  async record(context: Parameters<JobDeadletter['record']>[0], job: ClaimedJob, error: string): Promise<void> {
    const run = optionalText(optionalObject(job.payload)?.run);
    const scope = optionalText(job.scope);
    if (run !== null && scope !== null) await this.synchronization.fail(context, run, scope, error);
  }
}

function object(value: unknown): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('JOB_PAYLOAD_INVALID');
  return value as Readonly<Record<string, unknown>>;
}

function text(value: unknown, code: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(code);
  return value;
}

function optionalObject(value: unknown): Readonly<Record<string, unknown>> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Readonly<Record<string, unknown>>) : null;
}

function optionalText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}
