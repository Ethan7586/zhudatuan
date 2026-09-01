import type { ClaimedJob, JobProcessor } from '../../../../foundation/application/JobRunner';
import type { ChannelSyncKind } from '../../application/port/ChannelJobRepository';
import type { SynchronizeChannel } from '../../application/process/SynchronizeChannel';

export class ChannelSyncJob implements JobProcessor {
  constructor(
    private readonly kind: ChannelSyncKind,
    private readonly synchronization: SynchronizeChannel
  ) {}

  process(job: ClaimedJob, signal: AbortSignal, deadline = Date.now() + 300_000): Promise<void> {
    if (job.kind !== this.kind) throw new Error('JOB_KIND_MISMATCH');
    if (signal.aborted) throw signal.reason;
    const run = text(object(job.payload).run, 'CHANNEL_SYNC_RUN_REQUIRED');
    return this.synchronization.execute(run, { job: this.kind, trace: job.id, signal, deadline });
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
