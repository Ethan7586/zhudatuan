import type { ClaimedJob, JobProcessor } from '../../../runtime/public/JobProcess';
import type { CancelPayment } from '../../application/process/CancelPayment';
import { OrderCancelledSubscriber } from '../event/OrderCancelledSubscriber';

export class PaymentCancellationJob implements JobProcessor {
  private readonly subscriber = new OrderCancelledSubscriber();

  constructor(private readonly cancellation: CancelPayment) {}

  process(job: ClaimedJob, signal: AbortSignal, deadline = Date.now() + 30_000): Promise<void> {
    if (job.kind !== 'paymentcancel') throw new Error('JOB_KIND_MISMATCH');
    if (signal.aborted) throw signal.reason;
    const envelope = object(job.payload);
    const eventId = text(envelope.eventId, 'PAYMENT_CANCELLATION_EVENT_REQUIRED');
    const eventType = text(envelope.event, 'PAYMENT_CANCELLATION_TYPE_REQUIRED');
    const scopeId = text(envelope.scopeId, 'PAYMENT_CANCELLATION_SCOPE_REQUIRED');
    if (eventType !== 'order.cancelled') throw new Error('PAYMENT_CANCELLATION_EVENT_UNSUPPORTED');
    if (job.scope !== scopeId) throw new Error('PAYMENT_CANCELLATION_SCOPE_MISMATCH');
    return this.cancellation.execute(this.subscriber.receive(eventId, scopeId, object(envelope.payload)), signal, deadline);
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
