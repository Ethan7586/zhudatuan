import type { ClaimedJob, JobProcessor } from '../../../runtime/public/JobProcess';
import type { ProcessReferralEvent } from '../../application/process/ProcessReferralEvent';
import { OrderPaidSubscriber } from '../event/OrderPaidSubscriber';
import { OrderReceivedSubscriber } from '../event/OrderReceivedSubscriber';
import { RefundCompletedSubscriber } from '../event/RefundCompletedSubscriber';
import { WithdrawalApprovedSubscriber } from '../event/WithdrawalApprovedSubscriber';

export class ReferralEventJob implements JobProcessor {
  private readonly paid = new OrderPaidSubscriber();
  private readonly received = new OrderReceivedSubscriber();
  private readonly refunded = new RefundCompletedSubscriber();
  private readonly approved = new WithdrawalApprovedSubscriber();

  constructor(private readonly processor: ProcessReferralEvent) {}

  async process(job: ClaimedJob, signal: AbortSignal, deadline = Date.now() + 30_000): Promise<void> {
    if (job.kind !== 'referralevent') throw new Error('JOB_KIND_MISMATCH');
    if (signal.aborted) throw signal.reason;
    const envelope = object(job.payload);
    const eventId = text(envelope.eventId, 'REFERRAL_EVENT_ID_REQUIRED');
    const eventType = text(envelope.event, 'REFERRAL_EVENT_TYPE_REQUIRED');
    const scopeId = text(envelope.scopeId, 'REFERRAL_SCOPE_REQUIRED');
    if (job.scope !== scopeId) throw new Error('REFERRAL_SCOPE_MISMATCH');
    const payload = object(envelope.payload);
    const event =
      eventType === 'order.paid'
        ? this.paid.receive(eventId, scopeId, payload)
        : eventType === 'order.received'
          ? this.received.receive(eventId, scopeId, payload)
          : eventType === 'refund.completed'
            ? this.refunded.receive(eventId, scopeId, payload)
            : eventType === 'approval.instance.approved'
              ? this.approved.receive(eventId, scopeId, payload)
              : null;
    if (!event) throw new Error('REFERRAL_EVENT_UNSUPPORTED');
    await this.processor.execute(event, signal, deadline);
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
