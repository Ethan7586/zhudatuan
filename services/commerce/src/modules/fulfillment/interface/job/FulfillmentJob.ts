import type { ClaimedJob, JobProcessor } from '../../../runtime/public/JobProcess';
import type { RunFulfillment } from '../../application/process/RunFulfillment';

export class FulfillmentJob implements JobProcessor {
  constructor(
    private readonly kind: 'fulfillment' | 'tracking',
    private readonly fulfillment: RunFulfillment
  ) {}

  process(job: ClaimedJob, signal: AbortSignal, deadline = Date.now() + 300_000): Promise<void> {
    if (job.kind !== this.kind) throw new Error('JOB_KIND_MISMATCH');
    if (signal.aborted) throw signal.reason;
    const payload = object(job.payload);
    const execution = { scope: job.scope || 'system', trace: job.id, signal, deadline };
    if (this.kind === 'fulfillment' && payload.aftersale !== undefined) {
      return this.fulfillment.authorizeReturn(text(payload.aftersale, 'AFTERSALE_REQUIRED'), execution);
    }
    const id = optionalText(payload.fulfillment, 'FULFILLMENT_ID_REQUIRED');
    const operation = optionalText(payload.operation, 'PROVIDER_OPERATION_REQUIRED');
    return this.kind === 'fulfillment' ? this.fulfillment.submit(id, operation, execution) : this.fulfillment.track(id, operation, execution);
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

function optionalText(value: unknown, code: string): string | undefined {
  if (value === undefined) return undefined;
  return text(value, code);
}
