import type { ClaimedJob, JobProcessor } from '../../../runtime/public/JobProcess';
import type { RecoverPayment } from '../../application/process/RecoverPayment';

export class PaymentRecoveryJob implements JobProcessor {
  constructor(
    private readonly kind: 'paymentquery' | 'paymentrefund',
    private readonly recovery: RecoverPayment
  ) {}

  process(job: ClaimedJob, signal: AbortSignal, deadline = Date.now() + 30_000): Promise<void> {
    if (job.kind !== this.kind) throw new Error('JOB_KIND_MISMATCH');
    if (signal.aborted) throw signal.reason;
    const payload = object(job.payload);
    const execution = { signal, deadline, scope: job.scope || 'payment', trace: job.id };
    const event = optionalText(payload.providerEvent, 'PAYMENT_PROVIDER_EVENT_INVALID');
    if (this.kind === 'paymentquery') {
      return this.recovery.query(text(payload.intent, 'PAYMENT_INTENT_REQUIRED'), event, execution);
    }
    return this.recovery.refund(optionalText(payload.refund, 'PAYMENT_REFUND_REQUIRED'), optionalText(payload.aftersale, 'AFTERSALE_REQUIRED'), event, execution);
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
  if (value === undefined || value === null) return undefined;
  return text(value, code);
}
