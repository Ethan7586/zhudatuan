import type { ClaimedJob, JobProcessor } from '../../../runtime/public/JobProcess';
import type { ProcessOrderEvent } from '../../application/process/ProcessOrderEvent';
import { FulfillmentSubscriber } from '../event/FulfillmentSubscriber';
import { PaymentSubscriber } from '../event/PaymentSubscriber';
import { RefundSubscriber } from '../event/RefundSubscriber';

export class OrderEventJob implements JobProcessor {
  private readonly payment = new PaymentSubscriber();
  private readonly fulfillment = new FulfillmentSubscriber();
  private readonly refund = new RefundSubscriber();
  constructor(private readonly processor: ProcessOrderEvent) {}
  async process(job: ClaimedJob, signal: AbortSignal, deadline = Date.now() + 30_000): Promise<void> {
    if (job.kind !== 'orderevent') throw new Error('JOB_KIND_MISMATCH');
    if (signal.aborted) throw signal.reason;
    const envelope = object(job.payload);
    const eventId = text(envelope.eventId, 'ORDER_EVENT_ID_REQUIRED');
    const eventType = text(envelope.event, 'ORDER_EVENT_TYPE_REQUIRED');
    const scopeId = text(envelope.scopeId, 'ORDER_EVENT_SCOPE_REQUIRED');
    if (scopeId !== job.scope) throw new Error('ORDER_EVENT_SCOPE_MISMATCH');
    const payload = object(envelope.payload);
    const event = eventType === 'payment.captured' ? this.payment.receive(eventId, scopeId, payload)
      : eventType === 'fulfillment.shipped' ? this.fulfillment.receive(eventId, scopeId, payload)
        : eventType === 'refund.completed' ? this.refund.receive(eventId, scopeId, payload) : null;
    if (!event) throw new Error('ORDER_EVENT_UNSUPPORTED');
    await this.processor.execute(event, signal, deadline);
  }
}
function object(value: unknown): Readonly<Record<string, unknown>> { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('JOB_PAYLOAD_INVALID'); return value as Readonly<Record<string, unknown>>; }
function text(value: unknown, code: string): string { if (typeof value !== 'string' || !value) throw new Error(code); return value; }
