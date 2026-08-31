import type { ClaimedJob, JobProcessor } from '../../../../foundation/application/JobRunner';
import type { DatabasePool } from '../../../../foundation/persistence/Pool';
import type { FinancePoster } from '../../application/port/FinancePoster';
import { ProcessOrderEvent } from '../../application/command/ProcessOrderEvent';
import { OrderPaidSubscriber } from '../event/OrderPaidSubscriber';
import { OrderReceivedSubscriber } from '../event/OrderReceivedSubscriber';
import { RefundCompletedSubscriber } from '../event/RefundCompletedSubscriber';

export class ReferralEventJob implements JobProcessor {
  private readonly processor: ProcessOrderEvent;
  private readonly paid = new OrderPaidSubscriber();
  private readonly received = new OrderReceivedSubscriber();
  private readonly refunded = new RefundCompletedSubscriber();

  constructor(pool: DatabasePool, finance: FinancePoster) {
    this.processor = new ProcessOrderEvent(pool, finance);
  }

  async process(job: ClaimedJob, signal: AbortSignal): Promise<void> {
    if (job.kind !== 'referralevent') throw new Error('JOB_KIND_MISMATCH');
    if (signal.aborted) throw signal.reason;
    const envelope = object(job.payload);
    const eventId = text(envelope.eventId, 'REFERRAL_EVENT_ID_REQUIRED');
    const eventType = text(envelope.event, 'REFERRAL_EVENT_TYPE_REQUIRED');
    const scopeId = text(envelope.scopeId, 'REFERRAL_SCOPE_REQUIRED');
    if (job.scope_id !== scopeId) throw new Error('REFERRAL_SCOPE_MISMATCH');
    const payload = object(envelope.payload);
    const event =
      eventType === 'order.paid'
        ? this.paid.receive(eventId, scopeId, payload)
        : eventType === 'order.received'
          ? this.received.receive(eventId, scopeId, payload)
          : eventType === 'refund.completed'
            ? this.refunded.receive(eventId, scopeId, payload)
            : null;
    if (!event) throw new Error('REFERRAL_EVENT_UNSUPPORTED');
    await this.processor.execute(event);
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
