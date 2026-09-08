import type { ClaimedJob, JobProcessor } from '../../../runtime/public/JobProcess';
import type { ProcessFulfillmentEvent } from '../../application/process/ProcessFulfillmentEvent';
import { ChannelSubscriber } from '../event/ChannelSubscriber';
import { OrderSubscriber } from '../event/OrderSubscriber';
import { VerificationSubscriber } from '../event/VerificationSubscriber';

export class FulfillmentEventJob implements JobProcessor {
  private readonly orders = new OrderSubscriber();
  private readonly channels = new ChannelSubscriber();
  private readonly verifications = new VerificationSubscriber();

  constructor(private readonly events: ProcessFulfillmentEvent) {}

  process(job: ClaimedJob, signal: AbortSignal, deadline = Date.now() + 30_000): Promise<void> {
    if (job.kind !== 'fulfillmentevent') throw new Error('JOB_KIND_MISMATCH');
    if (signal.aborted) throw signal.reason;
    const envelope = object(job.payload);
    const eventId = text(envelope.eventId, 'FULFILLMENT_EVENT_REQUIRED');
    const eventType = text(envelope.event, 'FULFILLMENT_EVENT_TYPE_REQUIRED');
    const scopeId = text(envelope.scopeId, 'FULFILLMENT_SCOPE_REQUIRED');
    const sourceId = text(envelope.aggregateId, 'FULFILLMENT_AGGREGATE_REQUIRED');
    if (job.scope !== scopeId) throw new Error('FULFILLMENT_SCOPE_MISMATCH');
    const payload = object(envelope.payload);
    const event =
      eventType === 'order.paid'
        ? this.orders.receive(eventId, scopeId, payload)
        : eventType === 'aftersale.changed'
          ? this.orders.return(eventId, scopeId, sourceId, payload)
          : eventType === 'channel.webhook.applied'
            ? this.channels.receive(eventId, scopeId, sourceId, payload)
            : eventType === 'verification.completed'
              ? this.verifications.receive(eventId, scopeId, sourceId, payload)
              : null;
    if (!event) throw new Error('FULFILLMENT_EVENT_UNSUPPORTED');
    return this.events.execute(event, signal, deadline);
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
