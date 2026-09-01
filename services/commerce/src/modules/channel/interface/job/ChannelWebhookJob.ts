import type { ClaimedJob, JobProcessor } from '../../../../foundation/application/JobRunner';
import type { ApplyChannelWebhook } from '../../application/process/ApplyChannelWebhook';

export class ChannelWebhookJob implements JobProcessor {
  constructor(private readonly webhook: ApplyChannelWebhook) {}

  process(job: ClaimedJob, signal: AbortSignal, deadline = Date.now() + 30_000): Promise<void> {
    if (job.kind !== 'channelwebhook') throw new Error('JOB_KIND_MISMATCH');
    if (signal.aborted) throw signal.reason;
    const id = text(object(job.payload).webhook, 'CHANNEL_WEBHOOK_ID_REQUIRED');
    return this.webhook.execute(id, { scope: job.scope_id ?? 'organization-platform-root', trace: job.id, signal, deadline });
  }
}

function object(value: unknown): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('JOB_PAYLOAD_INVALID');
  return value as Readonly<Record<string, unknown>>;
}

function text(value: unknown, code: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(code);
  return value.trim();
}
