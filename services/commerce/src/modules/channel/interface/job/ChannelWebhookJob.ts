import type { ClaimedJob, JobDeadletter, JobProcessor } from '../../../runtime/public/JobProcess';
import type { ApplyChannelWebhook } from '../../application/process/ApplyChannelWebhook';

export class ChannelWebhookJob implements JobProcessor, JobDeadletter {
  constructor(private readonly webhook: ApplyChannelWebhook) {}

  process(job: ClaimedJob, signal: AbortSignal, deadline = Date.now() + 30_000): Promise<void> {
    if (job.kind !== 'channelwebhook') throw new Error('JOB_KIND_MISMATCH');
    if (signal.aborted) throw signal.reason;
    const id = text(object(job.payload).receipt, 'CHANNEL_WEBHOOK_RECEIPT_REQUIRED');
    const scope = text(job.scope, 'CHANNEL_WEBHOOK_SCOPE_REQUIRED');
    return this.webhook.execute(id, { scope, trace: job.id, signal, deadline });
  }

  async record(context: Parameters<JobDeadletter['record']>[0], job: ClaimedJob, error: string): Promise<void> {
    const payload = optionalObject(job.payload);
    const receipt = optional(payload?.receipt);
    const scope = optional(job.scope);
    if (receipt !== null && scope !== null) await this.webhook.fail(context, receipt, scope, error);
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

function optionalObject(value: unknown): Readonly<Record<string, unknown>> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Readonly<Record<string, unknown>>) : null;
}

function optional(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
